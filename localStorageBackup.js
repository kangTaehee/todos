const btnBackup = document.querySelector(".btn-backup");

btnBackup.addEventListener("click", (event) => {
	document.querySelector(".backup-restore-container").style.display = 'block'
	console.log(`🚀 ~ document.querySelector(".backup-restore-container").style:`, document.querySelector(".backup-restore-container").style)
});

// 로컬 스토리지에서 모든 관련 데이터를 가져오는 함수
function getLocalStorageBackupData() {
	// 저장된 키들을 확인합니다.
	const username = localStorage.getItem("username");
	const todosString = localStorage.getItem("todos");

	// 백업할 데이터를 하나의 객체로 구성
	const backupData = {
		username: username,
		todos: todosString ? JSON.parse(todosString) : [] // JSON.parse() 전에 문자열로 저장된 todo 배열을 다시 객체로 변환
	};

	// JSON.stringify(backupData)는 전체 백업 객체를 JSON 문자열로 만듭니다.
	// 하지만 textarea에 쉽게 복사할 수 있도록,
	// **로컬 스토리지에 저장된 형태 그대로** (즉, username은 문자열, todos는 JSON 문자열)
	// 혹은 **하나의 깔끔한 JSON 객체**로 만들 수 있습니다.

	// 💡 방법 1: 하나의 JSON 객체로 묶어 제공 (추천)
	// 사용자가 복구 시 하나의 덩어리만 복사/붙여넣기 하면 됩니다.
	return JSON.stringify(backupData, null, 2); // 보기 좋게 들여쓰기(2칸) 추가

	/* 💡 방법 2: 로컬 스토리지 항목별로 별도로 복사하게 할 수도 있지만, 불편합니다.
	return {
		username: username,
		todos: todosString
	};
	*/
}

// 백업 버튼 클릭 시 호출되는 함수
function handleBackup() {
	const backupTextarea = document.getElementById("backup-data");
	const dataString = getLocalStorageBackupData();

	backupTextarea.value = dataString;
	backupTextarea.select(); // 텍스트를 자동으로 선택하여 복사하기 쉽게 만듦
	// navigator.clipboard.writeText(dataString); // 최신 브라우저에서는 이 방법으로 자동 복사도 가능합니다.

	alert("데이터가 텍스트 상자에 로드되었습니다. 내용을 복사하여 안전한 곳에 저장하세요.");
}
// 복구 버튼 클릭 시 호출되는 함수
function handleRestore() {
	const backupTextarea = document.getElementById("backup-data");
	const dataString = backupTextarea.value.trim().replaceAll('\n','')
	
	console.log("🚀 ~ handleRestore ~ dataString:", dataString)

	if (!dataString) {
		alert("복구할 데이터가 텍스트 상자에 없습니다.");
		return;
	}

	try {
		// 1. JSON 문자열을 JavaScript 객체로 파싱
		const restoredData = JSON.parse(dataString);
		console.log("🚀 ~ handleRestore ~ restoredData:", restoredData)

		// 2. 데이터 유효성 검사 (최소한의 확인)
		if (restoredData && typeof restoredData.username === 'string' && Array.isArray(restoredData.todos)) {
			// 3. 로컬 스토리지에 데이터 저장
			localStorage.setItem("username", restoredData.username);

			// todos는 배열 형태이므로, 로컬 스토리지에 저장할 때는 JSON 문자열로 다시 변환해야 합니다.
			localStorage.setItem("todos", JSON.stringify(restoredData.todos));

			// 4. 애플리케이션의 상태(UI) 업데이트
			// 이 부분은 할 일 목록 앱의 상태 관리 로직에 따라 달라집니다.
			// 보통은 로컬 스토리지에서 데이터를 다시 읽어와서 UI를 새로 그립니다.
			// 예: loadTodosFromLocalStorageAndRender();

			alert("데이터 복구가 성공적으로 완료되었습니다. 페이지를 새로고침하여 적용하세요.");
		} else {
			throw new Error("데이터 구조가 올바르지 않습니다.");
		}

	} catch (e) {
		console.error("복구 실패:", e);
		alert("복구에 실패했습니다. 입력된 데이터가 올바른 JSON 형식이거나 유효한 백업 데이터가 아닙니다.");
	}
}