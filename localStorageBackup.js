const btnBackup = document.querySelector(".btn-backup");

btnBackup.addEventListener("click", () => {
	document.querySelector(".backup-restore-container").style.display = 'block';
});

async function handleBackup() {
	const username = localStorage.getItem("username");
	if (!username) {
		alert("로그인 후 백업이 가능합니다.");
		return;
	}

	const snapshot = await db.collection('users').doc(username)
		.collection('todos').orderBy('id').get();
	const todos = snapshot.docs.map(doc => doc.data());

	const backupData = { username, todos };
	const backupTextarea = document.getElementById("backup-data");
	backupTextarea.value = JSON.stringify(backupData, null, 2);
	backupTextarea.select();
	alert("데이터가 텍스트 상자에 로드되었습니다. 내용을 복사하여 안전한 곳에 저장하세요.");
}

async function handleRestore() {
	const backupTextarea = document.getElementById("backup-data");
	const dataString = backupTextarea.value.trim();

	if (!dataString) {
		alert("복구할 데이터가 텍스트 상자에 없습니다.");
		return;
	}

	try {
		const restoredData = JSON.parse(dataString);

		if (restoredData && typeof restoredData.username === 'string' && Array.isArray(restoredData.todos)) {
			localStorage.setItem("username", restoredData.username);

			// 기존 todos 삭제 후 복구 (batch 사용)
			const todosRef = db.collection('users').doc(restoredData.username).collection('todos');
			const existingSnapshot = await todosRef.get();

			const batch = db.batch();
			existingSnapshot.docs.forEach(doc => batch.delete(doc.ref));
			restoredData.todos.forEach(todo => {
				batch.set(todosRef.doc(String(todo.id)), todo);
			});
			await batch.commit();

			alert("데이터 복구가 성공적으로 완료되었습니다. 페이지를 새로고침하여 적용하세요.");
		} else {
			throw new Error("데이터 구조가 올바르지 않습니다.");
		}
	} catch (e) {
		console.error("복구 실패:", e);
		alert("복구에 실패했습니다. 입력된 데이터가 올바른 JSON 형식이거나 유효한 백업 데이터가 아닙니다.");
	}
}
