const firebaseConfig = {
    apiKey: "AIzaSyDyswlJTIm4NuhnAv8dNG8ij6zq0L8FmcU",
    authDomain: "txtfileviewer.firebaseapp.com",
    projectId: "txtfileviewer",
    storageBucket: "txtfileviewer.firebasestorage.app",
    messagingSenderId: "185707122313",
    appId: "1:185707122313:web:45b14964453e8139cb8058",
    measurementId: "G-ELZ4NBL705"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const notesColRef = db.collection('notes');

const overlay = document.getElementById('overlay');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const notesUl = document.getElementById('notesUl');
const newFileBtn = document.getElementById('newFileBtn');
const searchNotesInput = document.getElementById('searchNotesInput');
const themeToggle = document.getElementById('themeToggle');
const noteNameInput = document.getElementById('noteName');
const noteAuthorInput = document.getElementById('noteAuthor');
const notePasswordInput = document.getElementById('notePassword');
const noteContent = document.getElementById('noteContent');
const saveBtn = document.getElementById('saveBtn');
const txtBtn = document.getElementById('txtBtn');
const pdfBtn = document.getElementById('pdfBtn');
const txtBtnMobile = document.getElementById('txtBtnMobile');
const pdfBtnMobile = document.getElementById('pdfBtnMobile');
const exportToggle = document.getElementById('exportToggle');
const exportMenu = document.getElementById('exportMenu');
const editToggle = document.getElementById('editToggle');
const deleteOpenBtn = document.getElementById('deleteOpenBtn');
const deleteOpenBtnMobile = document.getElementById('deleteOpenBtnMobile');
const findToggle = document.getElementById('findToggle');
const searchPanel = document.getElementById('searchPanel');
const findBoxDropdown = document.getElementById('findBoxDropdown');
const closeSearch = document.getElementById('closeSearch');
const prevMatch = document.getElementById('prevMatch');
const nextMatch = document.getElementById('nextMatch');
const matchInfo = document.getElementById('matchInfo');
const extendBtn = document.getElementById('extendBtn');
const extendBtnMobile = document.getElementById('extendBtnMobile');
const insertTableBtn = document.getElementById('insertTableBtn');
const insertTableBtnMobile = document.getElementById('insertTableBtnMobile');

const dialogOverlay = document.getElementById('dialogOverlay');
const passwordDialog = document.getElementById('passwordDialog');
const dialogTitle = document.getElementById('dialogTitle');
const dialogAuthor = document.getElementById('dialogAuthor');
const dialogPasswordInput = document.getElementById('dialogPasswordInput');
const dialogCancel = document.getElementById('dialogCancel');
const dialogSubmit = document.getElementById('dialogSubmit');

const customDialogOverlay = document.getElementById('customDialogOverlay');
const customDialog = document.getElementById('customDialog');
const customDialogTitle = document.getElementById('customDialogTitle');
const customDialogMessage = document.getElementById('customDialogMessage');
const customDialogCancel = document.getElementById('customDialogCancel');
const customDialogConfirm = document.getElementById('customDialogConfirm');

const textareaContainer = document.querySelector('.textarea-container');
const readFsToggle = document.getElementById('readFsToggle');
const readFsIcon = document.getElementById('readFsIcon');

const ICON_EXPAND = 'expand.svg';
const ICON_COLLAPSE = 'collapse.svg';

let allNotes = [];
let isEditing = true;
let currentNoteId = '';
let currentNotePassword = '';
let currentSearchTerm = '';
let searchMatches = [];
let currentMatchIndex = -1;
let expirationCheckInterval = null;
let pendingNoteToOpen = null;
let pendingAction = null;
let pendingNoteToDelete = null;
let exportOutsideAbort = null;
let customDialogCleanup = null;

function openMenu() {
    document.body.classList.add('menu-open');
}

function closeMenu() {
    document.body.classList.remove('menu-open');
}

hamburgerBtn.addEventListener('click', openMenu);
overlay.addEventListener('click', closeMenu);

function showCustomDialogBase() {
    customDialogOverlay.classList.add('show');
    customDialog.classList.add('show');
}

function hideCustomDialog() {
    customDialogOverlay.classList.remove('show');
    customDialog.classList.remove('show');
    if (typeof customDialogCleanup === 'function') {
        customDialogCleanup();
        customDialogCleanup = null;
    }
}

function customAlert(message, title = 'Alert', type = 'info') {
    return new Promise((resolve) => {
        customDialogTitle.textContent = title;
        customDialogMessage.textContent = message;
        customDialogCancel.style.display = 'none';
        customDialogConfirm.textContent = 'OK';
        customDialogConfirm.className = 'dialog-btn confirm-btn';

        if (type === 'danger') customDialogConfirm.classList.add('danger');
        if (type === 'success') customDialogConfirm.classList.add('success');

        showCustomDialogBase();
        customDialogConfirm.focus();

        const handleConfirm = () => {
            hideCustomDialog();
            resolve();
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                handleConfirm();
            }
        };

        customDialogConfirm.onclick = handleConfirm;
        customDialogOverlay.onclick = handleConfirm;
        document.addEventListener('keydown', handleKeydown);

        customDialogCleanup = () => {
            customDialogConfirm.onclick = null;
            customDialogOverlay.onclick = null;
            document.removeEventListener('keydown', handleKeydown);
        };
    });
}

function customConfirm(message, title = 'Confirm', type = 'info') {
    return new Promise((resolve) => {
        customDialogTitle.textContent = title;
        customDialogMessage.textContent = message;
        customDialogCancel.style.display = 'inline-block';
        customDialogCancel.textContent = 'Cancel';
        customDialogConfirm.textContent = 'OK';
        customDialogConfirm.className = 'dialog-btn confirm-btn';

        if (type === 'danger') customDialogConfirm.classList.add('danger');
        if (type === 'success') customDialogConfirm.classList.add('success');

        showCustomDialogBase();
        customDialogConfirm.focus();

        const confirm = () => {
            hideCustomDialog();
            resolve(true);
        };

        const cancel = () => {
            hideCustomDialog();
            resolve(false);
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
            }
        };

        customDialogConfirm.onclick = confirm;
        customDialogCancel.onclick = cancel;
        customDialogOverlay.onclick = cancel;
        document.addEventListener('keydown', handleKeydown);

        customDialogCleanup = () => {
            customDialogConfirm.onclick = null;
            customDialogCancel.onclick = null;
            customDialogOverlay.onclick = null;
            document.removeEventListener('keydown', handleKeydown);
        };
    });
}

function showPasswordDialog(noteData, action = 'open') {
    pendingAction = action;

    if (action === 'open') {
        pendingNoteToOpen = noteData;
        dialogTitle.textContent = `Open: ${noteData.id}`;
        dialogAuthor.textContent = `By: ${noteData.author || 'Unknown'}`;
        dialogSubmit.textContent = 'Open';
    } else {
        pendingNoteToDelete = noteData;
        dialogTitle.textContent = `Delete: ${noteData.id}`;
        dialogAuthor.textContent = 'This action cannot be undone';
        dialogAuthor.style.color = '#e74c3c';
        dialogSubmit.textContent = 'Delete';
    }

    dialogPasswordInput.value = '';
    dialogOverlay.classList.add('show');
    passwordDialog.classList.add('show');
    dialogPasswordInput.focus();
}

function hidePasswordDialog() {
    dialogOverlay.classList.remove('show');
    passwordDialog.classList.remove('show');
    dialogPasswordInput.value = '';
    pendingNoteToOpen = null;
    pendingNoteToDelete = null;
    pendingAction = null;
    dialogAuthor.style.color = '';
}

dialogCancel.addEventListener('click', hidePasswordDialog);
dialogOverlay.addEventListener('click', hidePasswordDialog);

dialogSubmit.addEventListener('click', async () => {
    const enteredPassword = dialogPasswordInput.value;
    if (pendingAction === 'open' && pendingNoteToOpen) {
        await handlePasswordOpen(enteredPassword);
    } else if (pendingAction === 'delete' && pendingNoteToDelete) {
        await handlePasswordDelete(enteredPassword);
    }
});

dialogPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dialogSubmit.click();
    if (e.key === 'Escape') hidePasswordDialog();
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function normalizeEditorHtml(html) {
    const cleaned = (html || '')
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '')
        .trim();

    return cleaned === '<br>' ? '' : cleaned;
}

function getEditorHtml() {
    return normalizeEditorHtml(noteContent.innerHTML);
}

function getEditorText() {
    return (noteContent.innerText || '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function setEditorHtml(html) {
    noteContent.innerHTML = normalizeEditorHtml(html);
}

function clearSearchHighlights() {
    const marks = noteContent.querySelectorAll('mark.search-hit');
    marks.forEach((mark) => {
        const parent = mark.parentNode;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
    });
    searchMatches = [];
    currentMatchIndex = -1;
    matchInfo.textContent = 'No matches';
    prevMatch.disabled = true;
    nextMatch.disabled = true;
}

function collectTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (node.parentElement && node.parentElement.closest('mark.search-hit')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);
    return nodes;
}

function applyHighlights() {
    clearSearchHighlights();
    if (!currentSearchTerm) return;

    const term = currentSearchTerm.toLowerCase();
    const textNodes = collectTextNodes(noteContent);

    for (const node of textNodes) {
        const text = node.nodeValue;
        const lower = text.toLowerCase();
        let from = 0;
        let foundAny = false;
        const frag = document.createDocumentFragment();

        while (true) {
            const index = lower.indexOf(term, from);
            if (index === -1) break;

            foundAny = true;
            if (index > from) {
                frag.appendChild(document.createTextNode(text.slice(from, index)));
            }

            const mark = document.createElement('mark');
            mark.className = 'search-hit';
            mark.textContent = text.slice(index, index + term.length);
            frag.appendChild(mark);
            searchMatches.push(mark);

            from = index + term.length;
        }

        if (foundAny) {
            if (from < text.length) {
                frag.appendChild(document.createTextNode(text.slice(from)));
            }
            node.parentNode.replaceChild(frag, node);
        }
    }

    if (!searchMatches.length) {
        matchInfo.textContent = 'No matches';
        prevMatch.disabled = true;
        nextMatch.disabled = true;
        return;
    }

    currentMatchIndex = 0;
    updateCurrentMatch();
    prevMatch.disabled = false;
    nextMatch.disabled = false;
}

function updateCurrentMatch() {
    searchMatches.forEach((m, idx) => {
        m.classList.toggle('current-match', idx === currentMatchIndex);
    });

    if (searchMatches.length) {
        matchInfo.textContent = `${currentMatchIndex + 1} / ${searchMatches.length}`;
        searchMatches[currentMatchIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
        matchInfo.textContent = 'No matches';
    }
}

function goToPrevMatch() {
    if (!searchMatches.length) return;
    currentMatchIndex = currentMatchIndex <= 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
    updateCurrentMatch();
}

function goToNextMatch() {
    if (!searchMatches.length) return;
    currentMatchIndex = currentMatchIndex >= searchMatches.length - 1 ? 0 : currentMatchIndex + 1;
    updateCurrentMatch();
}

function placeCaretInside(el) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

function insertNodeAtCursor(node) {
    const sel = window.getSelection();
    if (!sel.rangeCount) {
        noteContent.appendChild(node);
        placeCaretInside(noteContent);
        return;
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
}

function insertHtmlAtCursor(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const fragment = document.createDocumentFragment();
    let lastNode = null;

    while (temp.firstChild) {
        lastNode = fragment.appendChild(temp.firstChild);
    }

    const sel = window.getSelection();
    if (!sel.rangeCount) {
        noteContent.appendChild(fragment);
        if (lastNode) placeCaretInside(noteContent);
        return;
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(fragment);

    if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

function isInsideEditorSelection() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    return noteContent.contains(range.commonAncestorContainer);
}

function setEditing(editing) {
    isEditing = editing;
    noteContent.contentEditable = editing ? 'true' : 'false';
    noteContent.classList.toggle('readonly', !editing);
    noteNameInput.style.display = editing ? '' : 'none';
    noteAuthorInput.parentElement.style.display = editing ? 'flex' : 'none';
    document.getElementById('buttons').style.display = editing ? 'flex' : 'none';

    if (editing) {
        noteContent.focus();
        placeCaretInside(noteContent);
    }
}

function clearEditor() {
    currentNoteId = '';
    currentNotePassword = '';
    noteNameInput.value = '';
    noteAuthorInput.value = '';
    notePasswordInput.value = '';
    setEditorHtml('');
    clearSearchHighlights();
    currentSearchTerm = '';
    findBoxDropdown.value = '';
    setEditing(true);
}

function createHtmlTable(rows, cols, data = []) {
    const table = document.createElement('table');
    table.className = 'freenote-table';

    for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');

        for (let c = 0; c < cols; c++) {
            const cell = document.createElement(r === 0 ? 'th' : 'td');
            cell.textContent = data[r]?.[c] ?? (r === 0 ? `Col ${c + 1}` : '');
            tr.appendChild(cell);
        }

        table.appendChild(tr);
    }

    return table.outerHTML;
}

function parsePlainTextTable(text) {
    const lines = text.replace(/\r/g, '').trim().split('\n');
    const rows = lines.map(line => line.split('\t'));
    if (rows.length < 2) return null;

    const maxCols = Math.max(...rows.map(r => r.length));
    if (maxCols < 2) return null;

    rows.forEach(r => {
        while (r.length < maxCols) r.push('');
    });

    return rows;
}

function extractCellsFromHtmlTable(table) {
    const rows = [...table.querySelectorAll('tr')];
    return rows.map(row => {
        const cells = [...row.querySelectorAll('th,td')];
        return cells.map(cell => cell.innerText.trim());
    });
}

function cleanPastedTable(table) {
    const rows = [...table.querySelectorAll('tr')];
    rows.forEach((row, rowIndex) => {
        const cells = [...row.children];
        cells.forEach((cell) => {
            const newCell = document.createElement(rowIndex === 0 ? 'th' : 'td');
            newCell.innerHTML = cell.innerHTML
                .replace(/<meta[^>]*>/gi, '')
                .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
                .trim();
            cell.replaceWith(newCell);
        });
    });
    table.removeAttribute('style');
    table.className = 'freenote-table';
    return table;
}

function insertGeneratedTable(rows, cols) {
    insertHtmlAtCursor(createHtmlTable(rows, cols));
}

async function showInsertTableDialog() {
    if (!isEditing) {
        await customAlert('Switch to edit mode first', 'Error', 'danger');
        return null;
    }

    const dialogHTML = `
        <div style="display:flex; gap:16px; align-items:center; justify-content:center; margin-top:8px;">
            <label style="display:flex; flex-direction:column; align-items:center; gap:4px; font-size:14px; color:var(--text-color);">
                Rows
                <input id="tableRowsInput" type="number" min="1" max="50" value="3"
                    style="width:64px; padding:8px; text-align:center; border:1px solid var(--input-border); border-radius:8px; background:var(--input-bg); color:var(--text-color); font-size:16px; font-family:inherit;" />
            </label>
            <span style="font-size:20px; opacity:0.5; margin-top:18px;">×</span>
            <label style="display:flex; flex-direction:column; align-items:center; gap:4px; font-size:14px; color:var(--text-color);">
                Columns
                <input id="tableColsInput" type="number" min="1" max="20" value="3"
                    style="width:64px; padding:8px; text-align:center; border:1px solid var(--input-border); border-radius:8px; background:var(--input-bg); color:var(--text-color); font-size:16px; font-family:inherit;" />
            </label>
        </div>
    `;

    return new Promise((resolve) => {
        customDialogTitle.textContent = 'Insert Table';
        customDialogMessage.innerHTML = dialogHTML;
        customDialogCancel.style.display = 'inline-block';
        customDialogCancel.textContent = 'Cancel';
        customDialogConfirm.textContent = 'Insert';
        customDialogConfirm.className = 'dialog-btn confirm-btn';

        showCustomDialogBase();

        setTimeout(() => {
            document.getElementById('tableRowsInput')?.focus();
        }, 50);

        const confirm = () => {
            const rows = Math.min(50, Math.max(1, parseInt(document.getElementById('tableRowsInput')?.value || '3', 10)));
            const cols = Math.min(20, Math.max(1, parseInt(document.getElementById('tableColsInput')?.value || '3', 10)));
            hideCustomDialog();
            resolve({ rows, cols });
        };

        const cancel = () => {
            hideCustomDialog();
            resolve(null);
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
            }
        };

        customDialogConfirm.onclick = confirm;
        customDialogCancel.onclick = cancel;
        customDialogOverlay.onclick = cancel;
        document.addEventListener('keydown', handleKeydown);

        customDialogCleanup = () => {
            customDialogConfirm.onclick = null;
            customDialogCancel.onclick = null;
            customDialogOverlay.onclick = null;
            document.removeEventListener('keydown', handleKeydown);
        };
    });
}

async function handleInsertTable() {
    const result = await showInsertTableDialog();
    if (result) {
        noteContent.focus();
        insertGeneratedTable(result.rows, result.cols);
    }
    closeExportMenu();
}

async function handlePasswordOpen(enteredPassword) {
    if (!pendingNoteToOpen) return;

    try {
        const snap = await notesColRef.doc(pendingNoteToOpen.id).get();
        const data = snap.data() || {};

        if (data.password === enteredPassword) {
            currentNoteId = pendingNoteToOpen.id;
            currentNotePassword = enteredPassword;
            noteNameInput.value = pendingNoteToOpen.id;
            noteAuthorInput.value = data.author || '';
            notePasswordInput.value = enteredPassword;
            setEditorHtml(data.content || '');
            clearSearchHighlights();
            currentSearchTerm = '';
            currentMatchIndex = -1;
            findBoxDropdown.value = '';
            searchPanel.classList.remove('open');
            setEditing(false);
            closeMenu();
            hidePasswordDialog();
        } else {
            await customAlert('Incorrect password!', 'Error', 'danger');
            dialogPasswordInput.value = '';
            dialogPasswordInput.focus();
        }
    } catch (err) {
        await customAlert('Error loading note: ' + err.message, 'Error', 'danger');
    }
}

async function handlePasswordDelete(enteredPassword) {
    if (!pendingNoteToDelete) return;

    try {
        const snap = await notesColRef.doc(pendingNoteToDelete.id).get();
        const data = snap.data() || {};

        if (data.password === enteredPassword) {
            const confirmed = await customConfirm(`Are you absolutely sure you want to delete "${pendingNoteToDelete.id}"?`, 'Confirm Deletion', 'danger');
            if (!confirmed) {
                hidePasswordDialog();
                return;
            }

            await notesColRef.doc(pendingNoteToDelete.id).delete();
            allNotes = allNotes.filter(x => x.id !== pendingNoteToDelete.id);
            renderList(filterNotes(searchNotesInput.value));

            if (currentNoteId === pendingNoteToDelete.id) clearEditor();

            hidePasswordDialog();
            await customAlert(`"${pendingNoteToDelete.id}" deleted successfully`, 'Success', 'success');
        } else {
            await customAlert('Incorrect password!', 'Error', 'danger');
            dialogPasswordInput.value = '';
            dialogPasswordInput.focus();
        }
    } catch (err) {
        await customAlert('Delete failed: ' + err.message, 'Error', 'danger');
        hidePasswordDialog();
    }
}

async function openNote(noteData) {
    try {
        const snap = await notesColRef.doc(noteData.id).get();
        const data = snap.data() || {};

        if (data.password && data.password.trim() !== '') {
            showPasswordDialog(noteData, 'open');
        } else {
            currentNoteId = noteData.id;
            currentNotePassword = '';
            noteNameInput.value = noteData.id;
            noteAuthorInput.value = data.author || '';
            notePasswordInput.value = '';
            setEditorHtml(data.content || '');
            clearSearchHighlights();
            currentSearchTerm = '';
            currentMatchIndex = -1;
            findBoxDropdown.value = '';
            searchPanel.classList.remove('open');
            setEditing(false);
            closeMenu();
        }
    } catch (err) {
        await customAlert('Error loading note: ' + err.message, 'Error', 'danger');
    }
}

async function deleteNoteFromList(noteData) {
    try {
        const snap = await notesColRef.doc(noteData.id).get();
        const data = snap.data() || {};

        if (data.password && data.password.trim() !== '') {
            showPasswordDialog(noteData, 'delete');
        } else {
            const confirmed = await customConfirm(`Delete "${noteData.id}"? (No password required)`, 'Confirm Deletion', 'danger');
            if (!confirmed) return;

            await notesColRef.doc(noteData.id).delete();
            allNotes = allNotes.filter(x => x.id !== noteData.id);
            renderList(filterNotes(searchNotesInput.value));

            if (currentNoteId === noteData.id) clearEditor();

            await customAlert(`"${noteData.id}" deleted successfully`, 'Success', 'success');
        }
    } catch (err) {
        await customAlert('Delete failed: ' + err.message, 'Error', 'danger');
    }
}

function positionExportMenu() {
    if (exportMenu.parentElement !== document.body) {
        document.body.appendChild(exportMenu);
    }

    const wasHidden = getComputedStyle(exportMenu).display === 'none';
    if (wasHidden) {
        exportMenu.style.visibility = 'hidden';
        exportMenu.style.display = 'block';
    }

    const rect = exportToggle.getBoundingClientRect();
    const menuWidth = exportMenu.offsetWidth;
    const menuHeight = exportMenu.offsetHeight;

    let top = rect.bottom + window.scrollY + 6;
    let left = rect.right - menuWidth + window.scrollX;

    const margin = 10;
    left = Math.max(margin + window.scrollX, Math.min(left, window.scrollX + window.innerWidth - menuWidth - margin));

    const maxBottom = window.scrollY + window.innerHeight - margin;
    if (top + menuHeight > maxBottom) {
        top = rect.top + window.scrollY - menuHeight - 6;
    }

    exportMenu.style.top = `${top}px`;
    exportMenu.style.left = `${left}px`;

    if (wasHidden) {
        exportMenu.style.display = '';
        exportMenu.style.visibility = '';
    }
}

function bindExportOutsideHandlers() {
    exportOutsideAbort = new AbortController();
    const signal = exportOutsideAbort.signal;

    window.addEventListener('pointerdown', (e) => {
        if (!exportMenu.classList.contains('open')) return;
        const onToggle = exportToggle.contains(e.target);
        const onMenu = exportMenu.contains(e.target);
        if (!onToggle && !onMenu) closeExportMenu();
    }, { capture: true, signal });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && exportMenu.classList.contains('open')) {
            closeExportMenu();
            exportToggle.focus();
        }
    }, { signal });

    window.addEventListener('resize', () => {
        if (exportMenu.classList.contains('open')) positionExportMenu();
    }, { signal });

    window.addEventListener('scroll', () => {
        if (exportMenu.classList.contains('open')) closeExportMenu();
    }, { capture: true, signal });
}

function unbindExportOutsideHandlers() {
    exportOutsideAbort?.abort();
    exportOutsideAbort = null;
}

function openExportMenu() {
    exportMenu.classList.add('open');
    exportToggle.setAttribute('aria-expanded', 'true');
    positionExportMenu();
    bindExportOutsideHandlers();
}

function closeExportMenu() {
    exportMenu.classList.remove('open');
    exportToggle.setAttribute('aria-expanded', 'false');
    unbindExportOutsideHandlers();
}

exportToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (exportMenu.classList.contains('open')) closeExportMenu();
    else openExportMenu();
});

exportMenu.addEventListener('click', (e) => e.stopPropagation());

function renderList(list) {
    notesUl.innerHTML = '';

    if (!list.length) {
        const li = document.createElement('li');
        li.className = 'note-item';
        li.style.opacity = '0.5';
        li.style.cursor = 'default';
        li.textContent = 'No notes found.';
        notesUl.appendChild(li);
        return;
    }

    list.forEach(n => {
        const li = document.createElement('li');
        li.className = 'note-item';
        li.tabIndex = 0;

        const contentContainer = document.createElement('div');
        contentContainer.className = 'note-item-content';

        const title = document.createElement('span');
        title.className = 'note-title';
        title.textContent = n.id;

        const authorDisplay = document.createElement('div');
        authorDisplay.className = 'note-author-display';
        const lockIcon = n.password && n.password.trim() !== '' ? '🔒 ' : '🔓 ';
        authorDisplay.textContent = `${lockIcon}By: ${n.author || 'Unknown'}`;

        contentContainer.appendChild(title);
        contentContainer.appendChild(authorDisplay);

        contentContainer.addEventListener('click', async (e) => {
            e.stopPropagation();
            await openNote(n);
        });

        const kebab = document.createElement('button');
        kebab.className = 'icon-btn kebab';
        kebab.title = 'More actions';
        kebab.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"/>
            </svg>
        `;

        const menu = document.createElement('div');
        menu.className = 'menu';

        const timer = document.createElement('div');
        timer.className = 'menu-timer';

        function updateExpirationTimer() {
            if (n.expiry) {
                const now = new Date();
                const expireDate = n.expiry.toDate();
                const diff = expireDate - now;

                if (diff <= 0) {
                    timer.textContent = 'Expired';
                    timer.style.color = '#e74c3c';
                } else {
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    timer.textContent = `${hours}h ${minutes}m left`;
                }
            } else {
                timer.textContent = 'No expiration';
            }
        }

        updateExpirationTimer();
        const timerInterval = setInterval(updateExpirationTimer, 60000);
        menu.appendChild(timer);

        const deleteItem = document.createElement('button');
        deleteItem.className = 'menu-item';
        deleteItem.textContent = 'Delete';
        menu.appendChild(deleteItem);

        function openKebabMenu(e) {
            e.stopPropagation();
            const rect = kebab.getBoundingClientRect();
            menu.style.top = (rect.bottom + window.scrollY + 6) + 'px';
            menu.style.left = (rect.right + window.scrollX - 150) + 'px';
            menu.classList.add('open');
            document.body.appendChild(menu);
        }

        function closeKebabMenu() {
            menu.classList.remove('open');
            clearInterval(timerInterval);
            if (menu.parentElement === document.body) document.body.removeChild(menu);
        }

        kebab.addEventListener('click', (e) => {
            e.stopPropagation();
            if (menu.classList.contains('open')) closeKebabMenu();
            else openKebabMenu(e);
        });

        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && e.target !== kebab) closeKebabMenu();
        });

        deleteItem.addEventListener('click', async (e) => {
            e.stopPropagation();
            closeKebabMenu();
            await deleteNoteFromList(n);
        });

        li.appendChild(contentContainer);
        li.appendChild(kebab);
        notesUl.appendChild(li);
    });
}

function filterNotes(q) {
    const t = (q || '').trim().toLowerCase();
    if (!t) return allNotes.slice();

    return allNotes.filter(n =>
        n.id.toLowerCase().includes(t) ||
        (n.author && n.author.toLowerCase().includes(t))
    );
}

async function loadList() {
    try {
        const snap = await notesColRef.orderBy(firebase.firestore.FieldPath.documentId()).get();
        allNotes = [];

        snap.forEach(d => {
            const data = d.data() || {};
            allNotes.push({
                id: d.id,
                author: data.author || 'Unknown',
                content: data.content || '',
                expiry: data.expiry || null,
                password: data.password || ''
            });
        });

        renderList(filterNotes(searchNotesInput.value));
    } catch (e) {
        notesUl.innerHTML = '<li class="note-item">Error loading notes.</li>';
        console.error(e);
    }
}

async function saveNote() {
    const id = noteNameInput.value.trim();
    const author = noteAuthorInput.value.trim();
    const password = notePasswordInput.value.trim();
    const content = getEditorHtml();

    if (!id) {
        await customAlert('Enter a note name', 'Validation Error', 'danger');
        return;
    }

    if (!author) {
        await customAlert('Enter author name', 'Validation Error', 'danger');
        return;
    }

    try {
        const now = new Date();
        const expiry = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

        await notesColRef.doc(id).set({
            content,
            author,
            password,
            expiry: firebase.firestore.Timestamp.fromDate(expiry),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const idx = allNotes.findIndex(n => n.id === id);
        if (idx >= 0) {
            allNotes[idx].content = content;
            allNotes[idx].author = author;
            allNotes[idx].password = password;
            allNotes[idx].expiry = firebase.firestore.Timestamp.fromDate(expiry);
        } else {
            allNotes.push({
                id,
                author,
                password,
                content,
                expiry: firebase.firestore.Timestamp.fromDate(expiry)
            });
        }

        allNotes.sort((a, b) => a.id.localeCompare(b.id));
        renderList(filterNotes(searchNotesInput.value));
        currentNoteId = id;
        currentNotePassword = password;

        const protectionStatus = password ? 'password-protected' : 'open (no password)';
        await customAlert(`Note saved as ${protectionStatus} (expires in 4 days)`, 'Success', 'success');
        setEditing(false);
    } catch (e) {
        await customAlert('Save failed: ' + e.message, 'Error', 'danger');
    }
}

async function deleteOpenNote() {
    const id = currentNoteId || noteNameInput.value.trim();
    if (!id) {
        await customAlert('No note open', 'Error', 'danger');
        return;
    }

    const password = currentNotePassword || notePasswordInput.value.trim();

    try {
        const snap = await notesColRef.doc(id).get();
        const data = snap.data() || {};

        if (data.password && data.password.trim() !== '') {
            if (data.password !== password) {
                await customAlert('Incorrect password!', 'Error', 'danger');
                return;
            }
        }

        const confirmed = await customConfirm(`Delete "${id}"?`, 'Confirm Deletion', 'danger');
        if (!confirmed) return;

        await notesColRef.doc(id).delete();
        allNotes = allNotes.filter(n => n.id !== id);
        renderList(filterNotes(searchNotesInput.value));
        clearEditor();
        closeExportMenu();
        await customAlert(`"${id}" deleted successfully`, 'Success', 'success');
    } catch (e) {
        await customAlert('Delete failed: ' + e.message, 'Error', 'danger');
    }
}

function exportTXT() {
    const name = noteNameInput.value.trim() || 'note';
    const content = getEditorText();
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    closeExportMenu();
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const left = 12, top = 12, right = 12, bottom = 12;
    const pageWidth = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : doc.internal.pageSize.height;
    const maxWidth = pageWidth - left - right;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);

    const content = getEditorText();
    const lines = doc.splitTextToSize(content, maxWidth);
    const lineHeight = 7;
    let y = top;

    lines.forEach((line) => {
        if (y + lineHeight > pageHeight - bottom) {
            doc.addPage();
            y = top;
        }
        doc.text(line, left, y);
        y += lineHeight;
    });

    doc.save((noteNameInput.value.trim() || 'note') + '.pdf');
    closeExportMenu();
}

async function autoDeleteExpiredNotes() {
    try {
        const now = new Date();
        const snap = await notesColRef.get();
        const batch = firebase.firestore().batch();
        let deletedCount = 0;

        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.expiry && data.expiry.toDate() < now) {
                batch.delete(docSnap.ref);
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            await batch.commit();
            await loadList();
            if (currentNoteId && !allNotes.find(n => n.id === currentNoteId)) {
                clearEditor();
            }
        }
    } catch (e) {
        console.error('Error deleting expired notes:', e);
    }
}

async function extendNoteLife(noteId) {
    if (!noteId) {
        await customAlert('No note selected', 'Error', 'danger');
        return;
    }

    try {
        const noteRef = notesColRef.doc(noteId);
        const docSnap = await noteRef.get();

        if (!docSnap.exists) {
            await customAlert('Note not found', 'Error', 'danger');
            return;
        }

        const data = docSnap.data();
        const password = currentNotePassword || notePasswordInput.value.trim();

        if (data.password && data.password.trim() !== '') {
            if (!password) {
                await customAlert('Password required to extend note', 'Error', 'danger');
                return;
            }
            if (data.password !== password) {
                await customAlert('Incorrect password!', 'Error', 'danger');
                return;
            }
        }

        const currentExpiry = data.expiry ? data.expiry.toDate() : new Date();
        const newExpiry = new Date(currentExpiry.getTime() + 24 * 60 * 60 * 1000);

        await noteRef.update({
            expiry: firebase.firestore.Timestamp.fromDate(newExpiry),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const noteIndex = allNotes.findIndex(n => n.id === noteId);
        if (noteIndex >= 0) {
            allNotes[noteIndex].expiry = firebase.firestore.Timestamp.fromDate(newExpiry);
        }

        renderList(filterNotes(searchNotesInput.value));
        await customAlert('Note extended by 24 hours!', 'Success', 'success');
        closeExportMenu();
    } catch (e) {
        console.error('Error extending note life:', e);
        await customAlert('Failed to extend note: ' + e.message, 'Error', 'danger');
    }
}

function loadTheme() {
    try {
        const t = localStorage.getItem('notepad-theme');
        if (t === 'light') {
            document.body.classList.add('light-mode');
            themeToggle.checked = true;
        } else {
            document.body.classList.remove('light-mode');
            themeToggle.checked = false;
        }
    } catch {}
}

themeToggle.addEventListener('change', () => {
    try {
        if (themeToggle.checked) {
            document.body.classList.add('light-mode');
            localStorage.setItem('notepad-theme', 'light');
        } else {
            document.body.classList.remove('light-mode');
            localStorage.setItem('notepad-theme', 'dark');
        }
    } catch {}
});

function isContainerFullscreen() {
    return document.fullscreenElement === textareaContainer;
}

function updateReadFsIcon() {
    if (isContainerFullscreen()) {
        readFsIcon.src = ICON_COLLAPSE;
        readFsToggle.title = 'Exit fullscreen';
        readFsToggle.setAttribute('aria-label', 'Exit fullscreen');
    } else {
        readFsIcon.src = ICON_EXPAND;
        readFsToggle.title = 'Enter fullscreen';
        readFsToggle.setAttribute('aria-label', 'Enter fullscreen');
    }
}

async function toggleReadFullscreen() {
    try {
        if (!isContainerFullscreen()) {
            await textareaContainer.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch (e) {
        console.error('Fullscreen toggle failed', e);
    } finally {
        updateReadFsIcon();
    }
}

readFsToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleReadFullscreen();
});

document.addEventListener('fullscreenchange', updateReadFsIcon);

findToggle.addEventListener('click', () => {
    const isOpen = searchPanel.classList.contains('open');
    if (isOpen) {
        searchPanel.classList.remove('open');
        clearSearchHighlights();
        currentSearchTerm = '';
        findBoxDropdown.value = '';
    } else {
        searchPanel.classList.add('open');
        findBoxDropdown.focus();
        findBoxDropdown.select();
    }
});

closeSearch.addEventListener('click', () => {
    searchPanel.classList.remove('open');
    currentSearchTerm = '';
    findBoxDropdown.value = '';
    clearSearchHighlights();
});

findBoxDropdown.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value.trim();
    applyHighlights();
});

findBoxDropdown.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) goToPrevMatch();
        else goToNextMatch();
    }
    if (e.key === 'Escape') {
        closeSearch.click();
    }
});

prevMatch.addEventListener('click', goToPrevMatch);
nextMatch.addEventListener('click', goToNextMatch);

noteContent.addEventListener('paste', (e) => {
    if (!isEditing) return;

    const clipboard = e.clipboardData;
    if (!clipboard) return;

    const html = clipboard.getData('text/html');
    const text = clipboard.getData('text/plain');

    if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const pastedTable = doc.querySelector('table');

        if (pastedTable) {
            e.preventDefault();
            const cleanTable = cleanPastedTable(pastedTable);
            insertHtmlAtCursor(cleanTable.outerHTML + '<p><br></p>');
            return;
        }
    }

    const rows = parsePlainTextTable(text);
    if (rows) {
        e.preventDefault();
        const htmlTable = createHtmlTable(rows.length, rows[0].length, rows);
        insertHtmlAtCursor(htmlTable + '<p><br></p>');
    }
});

noteContent.addEventListener('keydown', (e) => {
    if (!isEditing) return;

    if (e.key === 'Tab') {
        const cell = document.activeElement.closest?.('td, th') || window.getSelection().anchorNode?.parentElement?.closest?.('td, th');
        if (cell && noteContent.contains(cell)) {
            e.preventDefault();
            const cells = [...noteContent.querySelectorAll('th, td')];
            const index = cells.indexOf(cell);
            if (index !== -1) {
                const nextIndex = e.shiftKey ? Math.max(0, index - 1) : Math.min(cells.length - 1, index + 1);
                const target = cells[nextIndex];
                target.focus?.();
                placeCaretInside(target);
            }
        }
    }
});

newFileBtn.addEventListener('click', () => {
    clearEditor();
    noteNameInput.focus();
    closeMenu();
});

searchNotesInput.addEventListener('input', () => renderList(filterNotes(searchNotesInput.value)));

saveBtn.addEventListener('click', saveNote);
txtBtn.addEventListener('click', exportTXT);
pdfBtn.addEventListener('click', exportPDF);
deleteOpenBtn.addEventListener('click', deleteOpenNote);
insertTableBtn.addEventListener('click', handleInsertTable);

txtBtnMobile.addEventListener('click', exportTXT);
pdfBtnMobile.addEventListener('click', exportPDF);
deleteOpenBtnMobile.addEventListener('click', deleteOpenNote);
insertTableBtnMobile.addEventListener('click', handleInsertTable);

extendBtn.addEventListener('click', async () => {
    if (currentNoteId) await extendNoteLife(currentNoteId);
    else await customAlert('Open a note first', 'Error', 'danger');
});

extendBtnMobile.addEventListener('click', async () => {
    if (currentNoteId) await extendNoteLife(currentNoteId);
    else await customAlert('Open a note first', 'Error', 'danger');
});

editToggle.addEventListener('click', () => {
    const hasIdOrContent = !!(noteNameInput.value.trim() || getEditorText().trim());
    if (!hasIdOrContent) {
        setEditing(true);
        noteNameInput.focus();
    } else {
        setEditing(!isEditing);
    }
});

loadTheme();
setEditing(true);
loadList();
autoDeleteExpiredNotes();

expirationCheckInterval = setInterval(autoDeleteExpiredNotes, 5 * 60 * 60 * 1000);

window.addEventListener('beforeunload', () => {
    if (expirationCheckInterval) clearInterval(expirationCheckInterval);
});