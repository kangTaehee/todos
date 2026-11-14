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



// 로그인한 사용자의 Firebase Auth uid — Firestore 경로 users/{uid}의 키
let currentUid = null;
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

// 로그인 (Firebase Auth — Google 계정)
// 로그인 상태는 Firebase가 브라우저에 보관하므로 로그아웃 전까지 자동 유지된다.
const loginSection = document.getElementById("login");
const appSection = document.getElementById("app");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const loginMessage = document.getElementById("login-message");

// 이름 기반 로그인 시절의 자동 로그인 키 정리
localStorage.removeItem("username");

btnLogin.addEventListener("click", async () => {
	loginMessage.textContent = "";
	try {
		await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
	} catch (err) {
		if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
		console.error('로그인 실패:', err);
		loginMessage.textContent = err.code === 'auth/popup-blocked'
			? "팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도하세요."
			: `로그인에 실패했습니다. (${err.code || err.message})`;
	}
});

btnLogout.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(async (user) => {
	if (user) {
		await showLoggedIn(user);
	} else {
		showLoggedOut();
	}
});

function showLoggedOut() {
	currentUid = null;
	todos = [];
	todoList.innerHTML = "";
	bookmarkList.innerHTML = "";
	toastContainer.innerHTML = "";
	trashList.innerHTML = "";
	updateTrashCount();
	loginSection.classList.remove("hidden");
	appSection.classList.add("hidden");
	btnLogout.classList.add("hidden");
	document.getElementById("greeting").textContent = "";
}

async function showLoggedIn(user) {
	currentUid = user.uid;

	loginSection.classList.add("hidden");
	appSection.classList.remove("hidden");
	btnLogout.classList.remove("hidden");
	document.getElementById("greeting").textContent = `좋은 하루, ${user.displayName || "친구"}!`;

	try {
		await runPendingMigration(user.uid);

		const userRef = db.collection('users').doc(user.uid);
		const userDoc = await userRef.get();
		if (!userDoc.exists) {
			// 신규 사용자 — 현재 임시 배경 인덱스 저장
			await userRef.set({ bgIndex: tempBgIndex });
		} else if (userDoc.data().bgIndex !== undefined) {
			const savedIndex = userDoc.data().bgIndex;
			document.body.style.backgroundImage = `url(${bg[savedIndex]})`;
			document.querySelectorAll(".bg-thumb").forEach(t => {
				t.classList.toggle("active", Number(t.dataset.index) === savedIndex);
			});
		}

		await loadTodosFromFirestore(user.uid);
		await loadBookmarksFromFirestore(user.uid);
		await loadTrash(user.uid);
	} catch (err) {
		console.error('데이터 로드 실패:', err);
		alert(`데이터를 불러오지 못했습니다. (${err.code || err.message})`);
	}
}

// 이름 기반 데이터 → 계정(uid) 데이터 1회 이전
// 주소에 ?migrate=<토큰>이 있으면 users/migrate-<토큰> 문서의 할일·즐겨찾기를 내 계정으로 복사하고
// 이전용 문서는 삭제한다. 토큰을 모르면 문서를 찾을 수 없다(보안 규칙상 목록 조회 불가).
async function runPendingMigration(uid) {
	const params = new URLSearchParams(location.search);
	const token = params.get("migrate");
	if (!token) return;

	const migrationRef = db.collection('users').doc(`migrate-${token}`);
	const snap = await migrationRef.get();
	if (snap.exists) {
		const { todos: oldTodos = [], bookmarks: oldBookmarks = [], bgIndex } = snap.data();
		const userRef = db.collection('users').doc(uid);
		const batch = db.batch();
		oldTodos.forEach(t => batch.set(userRef.collection('todos').doc(String(t.id)), t));
		oldBookmarks.forEach(b => batch.set(userRef.collection('bookmarks').doc(String(b.id)), b));
		if (bgIndex !== undefined) batch.set(userRef, { bgIndex }, { merge: true });
		batch.delete(migrationRef);
		await batch.commit();
		alert(`기존 데이터를 계정으로 옮겼습니다. (할일 ${oldTodos.length}개, 즐겨찾기 ${oldBookmarks.length}개)`);
	} else {
		alert("이전할 데이터가 없거나 이미 옮겨졌습니다.");
	}

	params.delete("migrate");
	const query = params.toString();
	history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
}

// 투두리스트
const todoForm = document.getElementById("todo-form");
const newTodoInput = document.getElementById("new-todo");
const todoList = document.getElementById("todo-list");

todoForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	const newTodo = newTodoInput.value.trim();
	newTodoInput.value = "";
	if (!newTodo || !currentUid) return;

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

	await db.collection('users').doc(currentUid).collection('todos')
		.doc(String(newTodoObj.id)).set(newTodoObj);

	todos.push(newTodoObj);
	paintTodo(newTodoObj);
});

async function loadTodosFromFirestore(uid) {
	todoList.innerHTML = "";
	todos = [];

	const snapshot = await db.collection('users').doc(uid)
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
	const deleted = todos.find(todo => String(todo.id) === todoId);
	if (!deleted) return;

	const trashItem = await moveToTrash('todo', deleted);

	todos = todos.filter(todo => String(todo.id) !== todoId);
	li.remove();

	showUndoToast(`할일 삭제됨: ${trashLabel(trashItem)}`, () => restoreFromTrash(trashItem));
}

// 휴지통 — 삭제한 할일·즐겨찾기를 users/{uid}/trash에 보관해 새로고침 후에도 복구할 수 있게 한다.
// 문서: trash/{type}-{id} = { type: 'todo' | 'bookmark', data: 원본 문서, deletedAt: ms }
const TRASH_RETENTION_DAYS = 30;
const TRASH_COLLECTION = { todo: 'todos', bookmark: 'bookmarks' };
const trashSection = document.getElementById("trash");
const trashList = document.getElementById("trash-list");
const trashCount = document.getElementById("trash-count");
const btnTrashEmpty = document.getElementById("btn-trash-empty");

function trashDocId(item) {
	return `${item.type}-${item.data.id}`;
}

function trashLabel(item) {
	return item.type === 'todo' ? (item.data.title || item.data.text) : item.data.title;
}

// 원본 삭제와 휴지통 기록을 한 번에(원자적으로) 처리
async function moveToTrash(type, data) {
	const userRef = db.collection('users').doc(currentUid);
	const item = { type, data, deletedAt: Date.now() };
	const batch = db.batch();
	batch.delete(userRef.collection(TRASH_COLLECTION[type]).doc(String(data.id)));
	batch.set(userRef.collection('trash').doc(trashDocId(item)), item);
	await batch.commit();
	paintTrashItem(item, true);
	return item;
}

async function restoreFromTrash(item) {
	// 토스트와 휴지통 목록 양쪽에서 같은 항목을 복구하면 중복 표시되므로 한 번만 처리
	if (item.restored) return;
	const { type, data } = item;
	if (type === 'bookmark' && data.key && bookmarkList.querySelector(`li[data-key="${CSS.escape(data.key)}"]`)) {
		// 삭제 후 같은 단축키를 다른 즐겨찾기에 지정했다면 복구본의 단축키는 비운다
		data.key = null;
	}

	const userRef = db.collection('users').doc(currentUid);
	const batch = db.batch();
	batch.set(userRef.collection(TRASH_COLLECTION[type]).doc(String(data.id)), data);
	batch.delete(userRef.collection('trash').doc(trashDocId(item)));
	await batch.commit();
	item.restored = true;

	removeTrashItem(item);
	if (type === 'todo') {
		todos.push(data);
		todos.sort((a, b) => a.id - b.id);
		paintTodo(data);
		placeById(todoList, todoList.querySelector(`li[id="${data.id}"]`));
	} else {
		paintBookmark(data);
		placeById(bookmarkList, bookmarkList.querySelector(`li[id="${data.id}"]`));
	}
}

// 휴지통 로드 — 보관 기간이 지난 항목은 영구 삭제
async function loadTrash(uid) {
	trashList.innerHTML = "";
	const trashRef = db.collection('users').doc(uid).collection('trash');
	const snapshot = await trashRef.orderBy('deletedAt').get();
	const expireBefore = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

	const batch = db.batch();
	let expired = 0;
	snapshot.forEach(doc => {
		const item = doc.data();
		if (item.deletedAt < expireBefore) {
			batch.delete(doc.ref);
			expired++;
		} else {
			paintTrashItem(item, true);
		}
	});
	if (expired) await batch.commit();
	updateTrashCount();
}

// prepend: 최근 삭제가 위로 오도록 앞에 추가
function paintTrashItem(item, prepend) {
	const li = document.createElement("li");
	li.className = "trash-item";
	li.dataset.trashId = trashDocId(item);

	const type = document.createElement("span");
	type.className = "trash-type";
	type.textContent = item.type === 'todo' ? "할일" : "즐겨찾기";

	const title = document.createElement("span");
	title.className = "trash-title";
	title.textContent = trashLabel(item);
	title.title = item.type === 'todo' ? item.data.text : item.data.url;

	const date = document.createElement("span");
	date.className = "trash-date";
	const d = new Date(item.deletedAt);
	date.textContent = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

	const restoreButton = document.createElement("button");
	restoreButton.type = "button";
	restoreButton.textContent = "복구";
	restoreButton.addEventListener("click", async () => {
		restoreButton.disabled = true;
		try {
			await restoreFromTrash(item);
		} catch (err) {
			console.error('복구 실패:', err);
			alert(`복구에 실패했습니다. (${err.code || err.message})`);
			restoreButton.disabled = false;
		}
	});

	li.append(type, title, date, restoreButton);
	const existing = trashList.querySelector(`li[data-trash-id="${CSS.escape(li.dataset.trashId)}"]`);
	if (existing) existing.remove();
	if (prepend) trashList.prepend(li); else trashList.appendChild(li);
	updateTrashCount();
}

function removeTrashItem(item) {
	trashList.querySelector(`li[data-trash-id="${CSS.escape(trashDocId(item))}"]`)?.remove();
	updateTrashCount();
}

function updateTrashCount() {
	const count = trashList.children.length;
	trashCount.textContent = count;
	trashSection.classList.toggle("hidden", count === 0);
}

btnTrashEmpty.addEventListener("click", async () => {
	if (!currentUid) return;
	if (!confirm(`휴지통의 ${trashList.children.length}개 항목을 영구 삭제합니다. 계속할까요?`)) return;
	const trashRef = db.collection('users').doc(currentUid).collection('trash');
	const snapshot = await trashRef.get();
	const batch = db.batch();
	snapshot.forEach(doc => batch.delete(doc.ref));
	await batch.commit();
	trashList.innerHTML = "";
	toastContainer.innerHTML = "";
	updateTrashCount();
});

// 삭제 실행 취소 토스트 — 일정 시간 동안 "실행 취소" 버튼을 보여주고, 누르면 onUndo 실행
const UNDO_TIMEOUT = 7000;
const toastContainer = document.createElement("div");
toastContainer.id = "toast-container";
document.body.appendChild(toastContainer);

function showUndoToast(message, onUndo) {
	const toast = document.createElement("div");
	toast.className = "toast";

	const text = document.createElement("span");
	text.className = "toast-text";
	text.textContent = message;

	const undoButton = document.createElement("button");
	undoButton.type = "button";
	undoButton.textContent = "실행 취소";

	const close = () => {
		clearTimeout(timer);
		toast.remove();
	};
	const timer = setTimeout(close, UNDO_TIMEOUT);

	undoButton.addEventListener("click", async () => {
		undoButton.disabled = true;
		try {
			await onUndo();
			close();
		} catch (err) {
			console.error('실행 취소 실패:', err);
			text.textContent = "실행 취소에 실패했습니다.";
		}
	});

	toast.appendChild(text);
	toast.appendChild(undoButton);
	toastContainer.appendChild(toast);
}

// 복구된 항목을 id(생성 시각) 순서에 맞는 원래 위치로 옮긴다
function placeById(list, item) {
	if (!item) return;
	const next = [...list.children].find(li => li !== item && Number(li.id) > Number(item.id));
	list.insertBefore(item, next || null);
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
	if (!currentUid) {
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

	const bookmarksRef = db.collection('users').doc(currentUid).collection('bookmarks');

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

async function loadBookmarksFromFirestore(uid) {
	bookmarkList.innerHTML = "";
	exitBookmarkEditMode();

	const snapshot = await db.collection('users').doc(uid)
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
		// 수정으로 바뀌었을 수 있으므로 현재 화면 값 기준으로 보관
		const deleted = {
			title: link.textContent,
			url: link.dataset.url,
			key: item.dataset.key || null,
			id: bookmark.id
		};

		const trashItem = await moveToTrash('bookmark', deleted);
		if (editingBookmarkId === bookmark.id) exitBookmarkEditMode();
		item.remove();

		showUndoToast(`즐겨찾기 삭제됨: ${deleted.title}`, () => restoreFromTrash(trashItem));
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
	if (currentUid) {
		await db.collection('users').doc(currentUid).update({ bgIndex: index });
	}
}

function getCurrentDateYMD() {
	const now = new Date();
	const year = now.getFullYear() % 100;
	const month = now.getMonth() + 1;
	const day = now.getDate();
	return `${year}-${month}-${day}`;
}
