const bg = [
	'https://pbs.twimg.com/media/DBK-Jx-UAAU5hFH?format=jpg&name=large',
	'https://pbs.twimg.com/media/DBK-JyhUMAARHtx?format=jpg&name=large',
	'https://pbs.twimg.com/media/DBK-JyBUIAAdRPh?format=jpg&name=large',
	'https://pbs.twimg.com/media/DBK-Jx-UwAQJGje?format=jpg&name=large',
	'https://images.unsplash.com/photo-1501791187590-9ef2612ba1eb?q=80&w=2232&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
]

// 로그인 전 임시 랜덤 배경
const tempBgIndex = Math.floor(Math.random() * bg.length);
document.body.style.backgroundImage = `url(${bg[tempBgIndex]})`;



let currentUsername = null;
let todos = [];

// 실시간 시계
function updateClock() {
	const now = new Date();
	const hours = now.getHours().toString().padStart(2, "0");
	const minutes = now.getMinutes().toString().padStart(2, "0");
	const seconds = now.getSeconds().toString().padStart(2, "0");
	const clockElement = document.getElementById("clock");
	clockElement.innerHTML = `<span class="math-inline">${hours}\:</span>${minutes}:${seconds}`;
}
setInterval(updateClock, 1000);

// 로그인
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");

loginForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	const username = usernameInput.value.trim();
	if (!username) return;

	const userRef = db.collection('users').doc(username);
	const userDoc = await userRef.get();

	if (!userDoc.exists) {
		// 신규 사용자 — 현재 임시 배경 인덱스 저장
		await userRef.set({ username, bgIndex: tempBgIndex });
	}

	localStorage.setItem("username", username);
	await showLoggedIn(username);
});

async function showLoggedIn(username) {
	currentUsername = username;

	document.getElementById("login").classList.add("hidden");
	document.getElementById("todo").classList.remove("hidden");
	document.getElementById("greeting").textContent = `좋은 하루, ${username}!`;

	// Firestore에서 저장된 배경 로드
	const userDoc = await db.collection('users').doc(username).get();
	if (userDoc.exists && userDoc.data().bgIndex !== undefined) {
		const savedIndex = userDoc.data().bgIndex;
		document.body.style.backgroundImage = `url(${bg[savedIndex]})`;
		document.querySelectorAll(".bg-thumb").forEach(t => {
			t.classList.toggle("active", Number(t.dataset.index) === savedIndex);
		});
	}

	await loadTodosFromFirestore(username);
	await loadBookmarksFromFirestore(username);
}

// 자동 로그인
const savedUsername = localStorage.getItem("username");
if (savedUsername) {
	showLoggedIn(savedUsername);
}

// 투두리스트
const todoForm = document.getElementById("todo-form");
const newTodoInput = document.getElementById("new-todo");
const todoList = document.getElementById("todo-list");

todoForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	const newTodo = newTodoInput.value.trim();
	newTodoInput.value = "";
	if (!newTodo || !currentUsername) return;

	const parts = newTodo.split('|');
	const text = parts[0].trim();
	const title = parts[1]?.trim() || null;

	const newTodoObj = {
		text,
		title,
		id: Date.now(),
		done: false,
		datetime: getCurrentDateYMD()
	};

	await db.collection('users').doc(currentUsername).collection('todos')
		.doc(String(newTodoObj.id)).set(newTodoObj);

	todos.push(newTodoObj);
	paintTodo(newTodoObj);
});

async function loadTodosFromFirestore(username) {
	todoList.innerHTML = "";
	todos = [];

	const snapshot = await db.collection('users').doc(username)
		.collection('todos').orderBy('id').get();

	snapshot.forEach(doc => {
		const todo = doc.data();
		todos.push(todo);
		paintTodo(todo);
	});
}

function paintTodo(newTodoObj) {
	const todoItem = document.createElement("li");
	todoItem.id = newTodoObj.id;
	todoItem.classList.add("todo-item");

	const button = document.createElement("button");
	button.innerText = "~(>_<。)＼";
	button.addEventListener("click", deleteToDo);

	const copybutton = document.createElement("button");
	copybutton.innerText = "copy";
	copybutton.addEventListener("click", copyToDo);

	const todoText = document.createElement("span");
	todoText.textContent = newTodoObj.title || newTodoObj.text;
	todoText.dataset.url = newTodoObj.text;
	if (newTodoObj.title) todoText.classList.add("has-link");
	todoText.addEventListener("click", link);

	const todoInsertDateTime = document.createElement("span");
	todoInsertDateTime.textContent = newTodoObj.datetime;

	todoItem.appendChild(copybutton);
	todoItem.appendChild(todoText);
	todoItem.appendChild(todoInsertDateTime);
	todoItem.appendChild(button);

	todoList.appendChild(todoItem);
}

function link(e) {
	const url = e.target.dataset.url || e.target.textContent;
	if (url.startsWith('http') || url.startsWith('file') ) {
		window.open(url, '_blank');
	}
}

async function deleteToDo(e) {
	const li = e.target.parentElement;
	const todoId = String(li.id);

	await db.collection('users').doc(currentUsername)
		.collection('todos').doc(todoId).delete();

	todos = todos.filter(todo => String(todo.id) !== todoId);
	li.remove();
}

async function copyToDo(e) {
	const li = e.target.parentElement;
	const span = li.querySelector('span');
	const textdata = span.dataset.url || span.innerText;
	try {
		await navigator.clipboard.writeText(textdata);
		alert('클립보드에 복사되었습니다!');
	} catch (err) {
		console.error('복사 실패:', err);
	}
}

// 즐겨찾기
const bookmarkForm = document.getElementById("bookmark-form");
const bookmarkTitleInput = document.getElementById("bookmark-title");
const bookmarkUrlInput = document.getElementById("bookmark-url");
const bookmarkKeyInput = document.getElementById("bookmark-key");
const bookmarkSubmitBtn = document.getElementById("bookmark-submit");
const bookmarkCancelBtn = document.getElementById("bookmark-cancel");
const bookmarkList = document.getElementById("bookmark-list");

let editingBookmarkId = null;

bookmarkForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!currentUsername) {
		alert("로그인 후 이용 가능합니다.");
		return;
	}

	const title = bookmarkTitleInput.value.trim();
	const url = bookmarkUrlInput.value.trim();
	const key = bookmarkKeyInput.value.trim().toLowerCase() || null;
	if (!title || !url) return;

	// 단축키 중복 확인
	if (key === 'i') {
		alert("단축키 'i'는 할일 입력란 포커스용으로 예약되어 있습니다.");
		return;
	}
	if (key) {
		const dup = bookmarkList.querySelector(`li[data-key="${CSS.escape(key)}"]`);
		if (dup && String(dup.id) !== String(editingBookmarkId)) {
			alert(`단축키 '${key}'는 이미 사용 중입니다.`);
			return;
		}
	}

	const bookmarksRef = db.collection('users').doc(currentUsername).collection('bookmarks');

	if (editingBookmarkId) {
		// 수정
		await bookmarksRef.doc(String(editingBookmarkId)).update({ title, url, key });
		const item = bookmarkList.querySelector(`li[id="${editingBookmarkId}"]`);
		if (item) {
			const link = item.querySelector('.bookmark-link');
			link.textContent = title;
			link.dataset.url = url;
			link.title = url;
			applyBookmarkKey(item, key);
		}
		exitBookmarkEditMode();
	} else {
		// 추가
		const newBookmark = { title, url, key, id: Date.now() };
		await bookmarksRef.doc(String(newBookmark.id)).set(newBookmark);
		paintBookmark(newBookmark);
		bookmarkForm.reset();
	}
});

bookmarkCancelBtn.addEventListener("click", exitBookmarkEditMode);

function exitBookmarkEditMode() {
	editingBookmarkId = null;
	bookmarkForm.reset();
	bookmarkSubmitBtn.textContent = "추가";
	bookmarkCancelBtn.classList.add("hidden");
}

async function loadBookmarksFromFirestore(username) {
	bookmarkList.innerHTML = "";
	exitBookmarkEditMode();

	const snapshot = await db.collection('users').doc(username)
		.collection('bookmarks').orderBy('id').get();

	snapshot.forEach(doc => paintBookmark(doc.data()));
}

function paintBookmark(bookmark) {
	const item = document.createElement("li");
	item.id = bookmark.id;
	item.classList.add("bookmark-item");

	const link = document.createElement("span");
	link.classList.add("bookmark-link");
	link.textContent = bookmark.title;
	link.dataset.url = bookmark.url;
	link.title = bookmark.url;
	link.addEventListener("click", () => {
		window.open(link.dataset.url, '_blank', 'noopener');
	});

	const editButton = document.createElement("button");
	editButton.innerText = "✏️";
	editButton.title = "수정";
	editButton.addEventListener("click", () => {
		editingBookmarkId = bookmark.id;
		bookmarkTitleInput.value = link.textContent;
		bookmarkUrlInput.value = link.dataset.url;
		bookmarkKeyInput.value = item.dataset.key || "";
		bookmarkSubmitBtn.textContent = "수정";
		bookmarkCancelBtn.classList.remove("hidden");
		bookmarkTitleInput.focus();
	});

	const deleteButton = document.createElement("button");
	deleteButton.innerText = "🗑️";
	deleteButton.title = "삭제";
	deleteButton.addEventListener("click", async () => {
		await db.collection('users').doc(currentUsername)
			.collection('bookmarks').doc(String(bookmark.id)).delete();
		if (editingBookmarkId === bookmark.id) exitBookmarkEditMode();
		item.remove();
	});

	item.appendChild(link);
	item.appendChild(editButton);
	item.appendChild(deleteButton);
	applyBookmarkKey(item, bookmark.key);
	bookmarkList.appendChild(item);
}

// 뱃지에 단축키 표시(kbd)와 data-key 속성을 적용/제거
function applyBookmarkKey(item, key) {
	let kbd = item.querySelector('kbd');
	if (key) {
		item.dataset.key = key;
		if (!kbd) {
			kbd = document.createElement('kbd');
			item.insertBefore(kbd, item.querySelector('.bookmark-link'));
		}
		kbd.textContent = key;
	} else {
		delete item.dataset.key;
		if (kbd) kbd.remove();
	}
}

// 전역 단축키 — 입력창에 포커스가 없을 때 동작
// i: 할일 입력란 포커스 / 그 외: 즐겨찾기에 지정된 키면 링크가 새 창으로 열림
document.addEventListener("keydown", (e) => {
	if (e.ctrlKey || e.altKey || e.metaKey) return;
	const tag = e.target.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

	if (e.key.toLowerCase() === 'i') {
		e.preventDefault();
		newTodoInput.focus();
		return;
	}

	const item = bookmarkList.querySelector(`li[data-key="${CSS.escape(e.key.toLowerCase())}"]`);
	if (item) {
		const link = item.querySelector('.bookmark-link');
		window.open(link.dataset.url, '_blank', 'noopener');
	}
});

// 날씨
function getCurrentPosition() {
	return new Promise((resolve, reject) => {
		navigator.geolocation.getCurrentPosition(resolve, reject);
	});
}

async function getWeather(lat, lon) {
	const API_KEY = "d4fdf657104aefac06bb4daff3880eb6";
	const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`;
	const response = await fetch(url);
	return response.json();
}

async function showWeatherAndLocation() {
	const position = await getCurrentPosition();
	const { latitude, longitude } = position.coords;
	const weatherData = await getWeather(latitude, longitude);

	document.getElementById("weather-info").textContent = `현재 온도: ${weatherData.main.temp}°C, ${weatherData.weather[0].description}`;
	document.getElementById("location-info").textContent = `위치 : ${weatherData.name}(${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
}

// 위치 권한이 이미 허용된 경우에만 자동으로 조회하고, 그렇지 않으면
// 버튼 클릭(사용자 제스처) 시에만 요청해 매 방문마다 권한 팝업이 뜨는 것을 방지한다.
async function initWeather() {
	const btnWeather = document.getElementById("btn-weather");

	const requestWeather = () => {
		showWeatherAndLocation().catch(() => {
			document.getElementById("weather-info").textContent = "위치 권한이 필요합니다.";
			btnWeather.classList.remove("hidden");
		});
	};

	btnWeather.addEventListener("click", () => {
		btnWeather.classList.add("hidden");
		requestWeather();
	});

	if (!navigator.permissions?.query) {
		btnWeather.classList.remove("hidden");
		return;
	}

	try {
		const status = await navigator.permissions.query({ name: "geolocation" });
		if (status.state === "granted") {
			requestWeather();
		} else {
			btnWeather.classList.remove("hidden");
		}
	} catch {
		btnWeather.classList.remove("hidden");
	}
}

initWeather();

document.addEventListener("DOMContentLoaded", function() {
	initBgSelector();
});

// 배경 선택 UI
function initBgSelector() {
	const btnBg = document.getElementById("btn-bg");
	const selector = document.getElementById("bg-selector");

	bg.forEach((url, index) => {
		const thumb = document.createElement("div");
		thumb.className = "bg-thumb";
		thumb.style.backgroundImage = `url(${url})`;
		thumb.dataset.index = index;
		thumb.addEventListener("click", () => selectBg(index));
		selector.appendChild(thumb);
	});

	btnBg.addEventListener("click", (e) => {
		e.stopPropagation();
		selector.classList.toggle("open");
	});

	document.addEventListener("click", () => selector.classList.remove("open"));
}

async function selectBg(index) {
	document.body.style.backgroundImage = `url(${bg[index]})`;

	// 썸네일 active 상태 업데이트
	document.querySelectorAll(".bg-thumb").forEach(t => {
		t.classList.toggle("active", Number(t.dataset.index) === index);
	});

	// Firestore에 저장
	if (currentUsername) {
		await db.collection('users').doc(currentUsername).update({ bgIndex: index });
	}
}

function getCurrentDateYMD() {
	const now = new Date();
	const year = now.getFullYear() % 100;
	const month = now.getMonth() + 1;
	const day = now.getDate();
	return `${year}-${month}-${day}`;
}
