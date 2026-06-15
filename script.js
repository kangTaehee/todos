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
	if (url.startsWith('http')) {
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

showWeatherAndLocation();

document.addEventListener("DOMContentLoaded", function() {
	document.querySelector('#new-todo').focus();
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
