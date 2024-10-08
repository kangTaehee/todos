const bg = [
	'https://pbs.twimg.com/media/DBK-Jx-UAAU5hFH?format=jpg&name=large',
	'https://pbs.twimg.com/media/DBK-JyhUMAARHtx?format=jpg&name=large',
	'https://pbs.twimg.com/media/DBK-JyBUIAAdRPh?format=jpg&name=large',
	'https://pbs.twimg.com/media/DBK-Jx-UwAQJGje?format=jpg&name=large'
]
// 랜덤 이미지 선택
const randomIndex = Math.floor(Math.random() * bg.length);
const randomImage = bg[randomIndex];

// body 배경 지정
document.body.style.backgroundImage = `url(${randomImage})`;


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

// 로컬 스토리지 로그인
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");

loginForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const username = usernameInput.value;
	localStorage.setItem("username", username);
	// 로그인 후 처리
	showLoggedIn();
});

function showLoggedIn() {
	const loginSection = document.getElementById("login");
	loginSection.classList.add("hidden");
	const todoSection = document.getElementById("todo");
	todoSection.classList.remove("hidden");

	// 로컬 스토리지에서 이름 가져오기
	const username = localStorage.getItem("username");
	// 이름으로 맞이 메시지 출력
	const greetingElement = document.getElementById("greeting");
	greetingElement.textContent = `좋은 하루, ${username}!`;
};

// 로컬 스토리지에 저장된 이름이 있다면 로그인 처리
const savedUsername = localStorage.getItem("username");
if (savedUsername) {
	showLoggedIn();
}else{

}

// 로컬 스토리지 투두리스트
const todoForm = document.getElementById("todo-form");
const newTodoInput = document.getElementById("new-todo");
const todoList = document.getElementById("todo-list");

todoForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const newTodo = newTodoInput.value;
	newTodoInput.value = "";
	if (!newTodo) {
		return;
	}

	// 로컬 스토리지에서 투두리스트 목록 가져오기
	const todos = JSON.parse(localStorage.getItem("todos")) || [];
	const newTodoObj = {
		text: newTodo,
		id: Date.now(),
		done: false,
	}
	todos.push(newTodoObj);
	localStorage.setItem("todos", JSON.stringify(todos));

	// 화면에 투두리스트 추가
	paintTodo(newTodoObj)
	// const todoCheckbox
})

let todos = JSON.parse(localStorage.getItem("todos")) || [];
function loadTodo() {

	console.log(todos)
	todos.forEach(todo => paintTodo(todo))
}
loadTodo()
function paintTodo(newTodoObj) {
	// 화면에 투두리스트 추가
	const todoItem = document.createElement("li");
	todoItem.id=newTodoObj.id
	todoItem.classList.add("todo-item");

	const button = document.createElement("button");
	button.innerText = "~(>_<。)＼"
	button.addEventListener("click", deleteToDo)

	const copybutton = document.createElement("button");
	copybutton.innerText = "copy"
	copybutton.addEventListener("click", copyToDo)
	
	const todoText = document.createElement("span");
	todoText.textContent = newTodoObj.text;
	todoItem.appendChild(todoText);
	todoItem.appendChild(button);

	todoList.appendChild(todoItem);
}
function deleteToDo(e) {
	const li = e.target.parentElement
	todos = todos.filter(todo => {
		return todo.id != li.id
	})
	localStorage.setItem("todos", JSON.stringify(todos));
	li.remove()
}
async function copyToDo(e) {
	const li = e.target.parentElement
	const textdata = li.querySelector('span').text
	try {
		await navigator.clipboard.writeText(textdata);
		alert('클립보드에 복사되었습니다!');
	} catch (err) {
		console.error('복사 실패:', err);
	}

}

// Geolocation API를 사용하여 현재 위치 가져오기
function getCurrentPosition() {
	return new Promise((resolve, reject) => {
		navigator.geolocation.getCurrentPosition(resolve, reject);
	});
}

// OpenWeatherMap API를 사용하여 날씨 정보 가져오기
async function getWeather(lat, lon) {
	const API_KEY = "d4fdf657104aefac06bb4daff3880eb6"; // OpenWeatherMap API 키를 입력하세요
	const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
	const response = await fetch(url);
	const data = await response.json();
	return data;
}

// 위치와 날씨 정보를 화면에 표시하기
async function showWeatherAndLocation() {
	const position = await getCurrentPosition();
	const { latitude, longitude } = position.coords;
	const weatherData = await getWeather(latitude, longitude);

	const weatherInfoElement = document.getElementById("weather-info");
	const locationInfoElement = document.getElementById("location-info");

	weatherInfoElement.textContent = `현재 온도: ${weatherData.main.temp}°C, ${weatherData.weather[0].description}`;
	locationInfoElement.textContent = `위치 : ${weatherData.name}(${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
}

showWeatherAndLocation();

document.addEventListener("DOMContentLoaded", function() {
	document.querySelector('#new-todo').focus()
});