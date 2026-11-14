const btnBackup = document.querySelector(".btn-backup");

btnBackup.addEventListener("click", () => {
	document.querySelector(".backup-restore-container").style.display = 'block';
});

// 로그인한 계정(currentUid)의 할일·즐겨찾기를 JSON으로 내보낸다
async function handleBackup() {
	if (!currentUid) {
		alert("로그인 후 백업이 가능합니다.");
		return;
	}

	const userRef = db.collection('users').doc(currentUid);
	const [todoSnap, bookmarkSnap] = await Promise.all([
		userRef.collection('todos').orderBy('id').get(),
		userRef.collection('bookmarks').orderBy('id').get()
	]);

	const backupData = {
		todos: todoSnap.docs.map(doc => doc.data()),
		bookmarks: bookmarkSnap.docs.map(doc => doc.data())
	};
	const backupTextarea = document.getElementById("backup-data");
	backupTextarea.value = JSON.stringify(backupData, null, 2);
	backupTextarea.select();
	alert("데이터가 텍스트 상자에 로드되었습니다. 내용을 복사하여 안전한 곳에 저장하세요.");
}

// 백업 JSON으로 로그인한 계정의 데이터를 교체한다.
// 이전 형식({ username, todos })도 받으며, bookmarks가 없으면 즐겨찾기는 건드리지 않는다.
async function handleRestore() {
	if (!currentUid) {
		alert("로그인 후 복구가 가능합니다.");
		return;
	}

	const backupTextarea = document.getElementById("backup-data");
	const dataString = backupTextarea.value.trim();

	if (!dataString) {
		alert("복구할 데이터가 텍스트 상자에 없습니다.");
		return;
	}

	try {
		const restoredData = JSON.parse(dataString);
		if (!restoredData || !Array.isArray(restoredData.todos)) {
			throw new Error("데이터 구조가 올바르지 않습니다.");
		}
		if (!confirm("현재 계정의 데이터를 백업 내용으로 교체합니다. 계속할까요?")) return;

		const userRef = db.collection('users').doc(currentUid);
		const targets = [['todos', restoredData.todos]];
		if (Array.isArray(restoredData.bookmarks)) targets.push(['bookmarks', restoredData.bookmarks]);

		// 기존 문서 삭제 후 복구 (batch 사용)
		const batch = db.batch();
		for (const [name, items] of targets) {
			const ref = userRef.collection(name);
			const existing = await ref.get();
			existing.docs.forEach(doc => batch.delete(doc.ref));
			items.forEach(item => batch.set(ref.doc(String(item.id)), item));
		}
		await batch.commit();

		alert("데이터 복구가 성공적으로 완료되었습니다. 페이지를 새로고침하여 적용하세요.");
	} catch (e) {
		console.error("복구 실패:", e);
		alert("복구에 실패했습니다. 입력된 데이터가 올바른 JSON 형식이거나 유효한 백업 데이터가 아닙니다.");
	}
}
