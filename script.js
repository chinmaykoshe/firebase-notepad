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
const sidebar = document.getElementById('sidebar');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const notesUl = document.getElementById('notesUl');
const newFileBtn = document.getElementById('newFileBtn');
const searchNotesInput = document.getElementById('searchNotesInput');
const themeToggle = document.getElementById('themeToggle');
const noteNameInput = document.getElementById('noteName');
const noteAuthorInput = document.getElementById('noteAuthor');
const notePasswordInput = document.getElementById('notePassword');
const noteContent = document.getElementById('noteContent');
const highlightBackdrop = document.getElementById('highlightBackdrop');
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

// Password dialog elements
const dialogOverlay = document.getElementById('dialogOverlay');
const passwordDialog = document.getElementById('passwordDialog');
const dialogTitle = document.getElementById('dialogTitle');
const dialogAuthor = document.getElementById('dialogAuthor');
const dialogPasswordInput = document.getElementById('dialogPasswordInput');
const dialogCancel = document.getElementById('dialogCancel');
const dialogSubmit = document.getElementById('dialogSubmit');

// Custom Alert/Confirm Dialog elements
const customDialogOverlay = document.getElementById('customDialogOverlay');
const customDialog = document.getElementById('customDialog');
const customDialogTitle = document.getElementById('customDialogTitle');
const customDialogMessage = document.getElementById('customDialogMessage');
const customDialogCancel = document.getElementById('customDialogCancel');
const customDialogConfirm = document.getElementById('customDialogConfirm');

let allNotes = [];
let isEditing = true;
let currentNoteId = '';
let currentNotePassword = '';
let currentSearchTerm = '';
let matchPositions = [];
let currentMatchIndex = -1;
let expirationCheckInterval = null;
let pendingNoteToOpen = null;
let pendingAction = null;
let pendingNoteToDelete = null;

// ============================================
// CUSTOM ALERT/CONFIRM DIALOG SYSTEM
// ============================================

/**
 * Show custom alert dialog
 * @param {string} message - The message to display
 * @param {string} title - Dialog title (default: "Alert")
 * @param {string} type - Type: 'info', 'success', 'danger' (default: 'info')
 * @returns {Promise<void>}
 */
function customAlert(message, title = "Alert", type = "info") {
    return new Promise((resolve) => {
        customDialogTitle.textContent = title;
        customDialogMessage.textContent = message;
        customDialogCancel.style.display = 'none';
        customDialogConfirm.textContent = 'OK';

        // Apply button styling based on type
        customDialogConfirm.className = 'dialog-btn confirm-btn';
        if (type === 'danger') {
            customDialogConfirm.classList.add('danger');
        } else if (type === 'success') {
            customDialogConfirm.classList.add('success');
        }

        customDialogOverlay.classList.add('show');
        customDialog.classList.add('show');
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

        // Cleanup function
        const cleanup = () => {
            customDialogConfirm.onclick = null;
            customDialogOverlay.onclick = null;
            document.removeEventListener('keydown', handleKeydown);
        };

        // Store cleanup for later
        customDialog.dataset.cleanup = cleanup;
    });
}

/**
 * Show custom confirm dialog
 * @param {string} message - The message to display
 * @param {string} title - Dialog title (default: "Confirm")
 * @param {string} type - Type: 'info', 'danger' (default: 'info')
 * @returns {Promise<boolean>} - true if confirmed, false if cancelled
 */
function customConfirm(message, title = "Confirm", type = "info") {
    return new Promise((resolve) => {
        customDialogTitle.textContent = title;
        customDialogMessage.textContent = message;
        customDialogCancel.style.display = 'inline-block';
        customDialogCancel.textContent = 'Cancel';
        customDialogConfirm.textContent = 'OK';

        // Apply button styling based on type
        customDialogConfirm.className = 'dialog-btn confirm-btn';
        if (type === 'danger') {
            customDialogConfirm.classList.add('danger');
        } else if (type === 'success') {
            customDialogConfirm.classList.add('success');
        }

        customDialogOverlay.classList.add('show');
        customDialog.classList.add('show');
        customDialogConfirm.focus();

        const handleConfirm = () => {
            hideCustomDialog();
            resolve(true);
        };

        const handleCancel = () => {
            hideCustomDialog();
            resolve(false);
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        };

        customDialogConfirm.onclick = handleConfirm;
        customDialogCancel.onclick = handleCancel;
        customDialogOverlay.onclick = handleCancel;
        document.addEventListener('keydown', handleKeydown);

        // Cleanup function
        const cleanup = () => {
            customDialogConfirm.onclick = null;
            customDialogCancel.onclick = null;
            customDialogOverlay.onclick = null;
            document.removeEventListener('keydown', handleKeydown);
        };

        customDialog.dataset.cleanup = cleanup;
    });
}

/**
 * Hide custom dialog and cleanup event listeners
 */
function hideCustomDialog() {
    customDialogOverlay.classList.remove('show');
    customDialog.classList.remove('show');

    // Run cleanup if it exists
    if (typeof customDialog.dataset.cleanup === 'function') {
        customDialog.dataset.cleanup();
        delete customDialog.dataset.cleanup;
    }
}

// ============================================
// END CUSTOM DIALOG SYSTEM
// ============================================

function openMenu() { document.body.classList.add('menu-open'); }
function closeMenu() { document.body.classList.remove('menu-open'); }
hamburgerBtn.addEventListener('click', openMenu);
overlay.addEventListener('click', closeMenu);

// Enhanced Password Dialog Functions
function showPasswordDialog(noteData, action = 'open') {
    pendingAction = action;

    if (action === 'open') {
        pendingNoteToOpen = noteData;
        dialogTitle.textContent = `Open: ${noteData.id}`;
        dialogAuthor.textContent = `By: ${noteData.author || 'Unknown'}`;
    } else if (action === 'delete') {
        pendingNoteToDelete = noteData;
        dialogTitle.textContent = `Delete: ${noteData.id}`;
        dialogAuthor.textContent = `⚠️ This action cannot be undone`;
        dialogAuthor.style.color = '#e74c3c';
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

// Handle password verification for opening notes
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
            noteContent.value = data.content || '';
            currentSearchTerm = '';
            currentMatchIndex = -1;
            matchPositions = [];
            applyHighlights();
            setEditing(false);
            findBoxDropdown.value = '';
            searchPanel.classList.remove('open');
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

// Handle password verification for deleting notes
async function handlePasswordDelete(enteredPassword) {
    if (!pendingNoteToDelete) return;

    try {
        const snap = await notesColRef.doc(pendingNoteToDelete.id).get();
        const data = snap.data() || {};

        if (data.password === enteredPassword) {
            const confirmed = await customConfirm(
                `Are you absolutely sure you want to delete "${pendingNoteToDelete.id}"?`,
                'Confirm Deletion',
                'danger'
            );

            if (!confirmed) {
                hidePasswordDialog();
                return;
            }

            await notesColRef.doc(pendingNoteToDelete.id).delete();
            allNotes = allNotes.filter(x => x.id !== pendingNoteToDelete.id);
            renderList(filterNotes(searchNotesInput.value));

            if (currentNoteId === pendingNoteToDelete.id) {
                clearEditor();
            }

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

dialogPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        dialogSubmit.click();
    } else if (e.key === 'Escape') {
        hidePasswordDialog();
    }
});

// Open note directly if no password is set
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
            noteContent.value = data.content || '';
            currentSearchTerm = '';
            currentMatchIndex = -1;
            matchPositions = [];
            applyHighlights();
            setEditing(false);
            findBoxDropdown.value = '';
            searchPanel.classList.remove('open');
            closeMenu();
        }
    } catch (err) {
        await customAlert('Error loading note: ' + err.message, 'Error', 'danger');
    }
}

// Delete note with conditional password check
async function deleteNoteFromList(noteData) {
    try {
        const snap = await notesColRef.doc(noteData.id).get();
        const data = snap.data() || {};

        if (data.password && data.password.trim() !== '') {
            showPasswordDialog(noteData, 'delete');
        } else {
            const confirmed = await customConfirm(
                `Delete "${noteData.id}"? (No password required)`,
                'Confirm Deletion',
                'danger'
            );

            if (!confirmed) return;

            await notesColRef.doc(noteData.id).delete();
            allNotes = allNotes.filter(x => x.id !== noteData.id);
            renderList(filterNotes(searchNotesInput.value));

            if (currentNoteId === noteData.id) {
                clearEditor();
            }

            await customAlert(`"${noteData.id}" deleted successfully`, 'Success', 'success');
        }
    } catch (err) {
        await customAlert('Delete failed: ' + err.message, 'Error', 'danger');
    }
}

// Export menu functions
let exportOutsideAbort = null;

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
    left = Math.max(
        margin + window.scrollX,
        Math.min(left, window.scrollX + window.innerWidth - menuWidth - margin)
    );

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

function setEditing(editing) {
    isEditing = editing;
    noteContent.readOnly = !editing;
    noteContent.classList.toggle('readonly', !editing);
    noteNameInput.style.display = editing ? '' : 'none';
    noteAuthorInput.parentElement.style.display = editing ? 'flex' : 'none';
    document.getElementById('buttons').style.display = editing ? 'flex' : 'none';

    if (editing) {
        noteContent.focus(); // Focus on content for immediate multi-line editing (Enter for newlines)
    }
}

function clearEditor() {
    currentNoteId = '';
    currentNotePassword = '';
    noteNameInput.value = '';
    noteAuthorInput.value = '';
    notePasswordInput.value = '';
    noteContent.value = '';
    highlightBackdrop.innerHTML = '';
    setEditing(true);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyHighlights() {
    const text = noteContent.value;
    let highlightedText = escapeHtml(text);
    matchPositions = [];

    if (currentSearchTerm) {
        const regex = new RegExp(escapeRegex(currentSearchTerm), 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
            matchPositions.push({ start: match.index, end: match.index + match[0].length });
        }

        if (matchPositions.length > 0) {
            let lastIndex = 0;
            let result = '';
            matchPositions.forEach((pos, idx) => {
                result += escapeHtml(text.substring(lastIndex, pos.start));
                const classAttr = idx === currentMatchIndex ? ' class="current-match"' : '';
                result += `<mark${classAttr}>${escapeHtml(text.substring(pos.start, pos.end))}</mark>`;
                lastIndex = pos.end;
            });
            result += escapeHtml(text.substring(lastIndex));
            highlightedText = result;

            updateMatchInfo();
        } else {
            matchInfo.textContent = 'No matches';
            currentMatchIndex = -1;
        }

        prevMatch.disabled = matchPositions.length === 0;
        nextMatch.disabled = matchPositions.length === 0;
    } else {
        matchInfo.textContent = 'No matches';
        currentMatchIndex = -1;
        prevMatch.disabled = true;
        nextMatch.disabled = true;
    }

    if (text.endsWith('\n')) {
        highlightedText += '\n';
    }

    highlightBackdrop.innerHTML = highlightedText;
}

function updateMatchInfo() {
    if (matchPositions.length === 0) {
        matchInfo.textContent = 'No matches';
    } else {
        matchInfo.textContent = `${currentMatchIndex + 1} / ${matchPositions.length}`;
    }
}

function scrollToMatch(index) {
    if (index < 0 || index >= matchPositions.length) return;

    const pos = matchPositions[index];
    noteContent.focus();
    noteContent.setSelectionRange(pos.start, pos.end);

    const lineHeight = 1.65;
    const fontSize = 0.95;
    const lines = noteContent.value.substring(0, pos.start).split('\n').length;
    const scrollTop = (lines - 5) * (fontSize * 16 * lineHeight);
    noteContent.scrollTop = Math.max(0, scrollTop);

    syncScroll();
}

function goToPrevMatch() {
    if (matchPositions.length === 0) return;
    currentMatchIndex = currentMatchIndex <= 0 ? matchPositions.length - 1 : currentMatchIndex - 1;
    applyHighlights();
    scrollToMatch(currentMatchIndex);
}

function goToNextMatch() {
    if (matchPositions.length === 0) return;
    currentMatchIndex = currentMatchIndex >= matchPositions.length - 1 ? 0 : currentMatchIndex + 1;
    applyHighlights();
    scrollToMatch(currentMatchIndex);
}

function syncScroll() {
    highlightBackdrop.scrollTop = noteContent.scrollTop;
    highlightBackdrop.scrollLeft = noteContent.scrollLeft;
}

noteContent.addEventListener('input', applyHighlights);
noteContent.addEventListener('scroll', syncScroll);

findToggle.addEventListener('click', () => {
    const isOpen = searchPanel.classList.contains('open');
    if (isOpen) {
        searchPanel.classList.remove('open');
    } else {
        searchPanel.classList.add('open');
        findBoxDropdown.focus();
        findBoxDropdown.select();
    }
});

closeSearch.addEventListener('click', () => {
    searchPanel.classList.remove('open');
    currentSearchTerm = '';
    currentMatchIndex = -1;
    matchPositions = [];
    applyHighlights();
});

findBoxDropdown.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value.trim();
    currentMatchIndex = -1;
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
        title.title = 'Open note';

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
                    timer.textContent = '⏰ Expired';
                    timer.style.color = '#e74c3c';
                } else {
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    timer.textContent = `⏰ ${hours}h ${minutes}m left`;
                }
            } else {
                timer.textContent = '⏰ No expiration';
            }
        }

        updateExpirationTimer();
        const timerInterval = setInterval(updateExpirationTimer, 60000);
        menu.appendChild(timer);

        const deleteItem = document.createElement('button');
        deleteItem.className = 'menu-item';
        deleteItem.textContent = '🗑️ Delete';
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
        const snap = await notesColRef
            .orderBy('content').orderBy(firebase.firestore.FieldPath.documentId())
            .get();
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
        const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        await notesColRef.doc(id).set({
            content: noteContent.value || '',
            author: author,
            password: password,
            expiry: firebase.firestore.Timestamp.fromDate(expiry),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const idx = allNotes.findIndex(n => n.id === id);
        if (idx >= 0) {
            allNotes[idx].content = noteContent.value || '';
            allNotes[idx].author = author;
            allNotes[idx].password = password;
            allNotes[idx].expiry = firebase.firestore.Timestamp.fromDate(expiry);
        } else {
            allNotes.push({
                id,
                author,
                password,
                content: noteContent.value || '',
                expiry: firebase.firestore.Timestamp.fromDate(expiry)
            });
        }
        allNotes.sort((a, b) => a.id.localeCompare(b.id));
        renderList(filterNotes(searchNotesInput.value));
        currentNoteId = id;
        currentNotePassword = password;

        const protectionStatus = password ? 'password-protected' : 'open (no password)';
        await customAlert(`Note saved as ${protectionStatus} (expires in 24 hours)`, 'Success', 'success');
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
    const content = noteContent.value || '';
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

    const content = noteContent.value || '';
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

    const name = (noteNameInput.value.trim() || 'note') + '.pdf';
    doc.save(name);
    closeExportMenu();
}

async function autoDeleteExpiredNotes() {
    try {
        const now = new Date();
        const snap = await notesColRef.get();
        const batch = firebase.firestore().batch();
        let deletedCount = 0;

        snap.forEach(doc => {
            const data = doc.data();
            if (data.expiry && data.expiry.toDate() < now) {
                batch.delete(doc.ref);
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            await batch.commit();
            console.log(`Deleted ${deletedCount} expired note(s)`);
            await loadList();

            if (currentNoteId && !allNotes.find(n => n.id === currentNoteId)) {
                clearEditor();
            }
        }
    } catch (e) {
        console.error("Error deleting expired notes:", e);
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

        if (docSnap.exists) {
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
            await customAlert("Note extended by 24 hours!", 'Success', 'success');
            closeExportMenu();
        } else {
            await customAlert('Note not found', 'Error', 'danger');
        }
    } catch (e) {
        console.error("Error extending note life:", e);
        await customAlert('Failed to extend note: ' + e.message, 'Error', 'danger');
    }
}

// Event Listeners
saveBtn.addEventListener('click', saveNote);
txtBtn.addEventListener('click', exportTXT);
pdfBtn.addEventListener('click', exportPDF);
deleteOpenBtn.addEventListener('click', deleteOpenNote);

txtBtnMobile.addEventListener('click', exportTXT);
pdfBtnMobile.addEventListener('click', exportPDF);
deleteOpenBtnMobile.addEventListener('click', deleteOpenNote);

extendBtn.addEventListener('click', async () => {
    if (currentNoteId) await extendNoteLife(currentNoteId);
    else await customAlert('Open a note first', 'Error', 'danger');
});

extendBtnMobile.addEventListener('click', async () => {
    if (currentNoteId) await extendNoteLife(currentNoteId);
    else await customAlert('Open a note first', 'Error', 'danger');
});

editToggle.addEventListener('click', () => {
    const hasIdOrContent = !!(noteNameInput.value.trim() || noteContent.value);
    if (!hasIdOrContent) {
        setEditing(true);
        noteNameInput.focus();
    } else {
        setEditing(!isEditing);
        if (isEditing) {
            noteContent.focus(); // Focus on content for editing with newlines
        }
    }
});

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
    } catch { }
}

themeToggle.addEventListener('change', () => {
    if (themeToggle.checked) {
        document.body.classList.add('light-mode');
        localStorage.setItem('notepad-theme', 'light');
    } else {
        document.body.classList.remove('light-mode');
        localStorage.setItem('notepad-theme', 'dark');
    }
});

// Fullscreen functionality
const textareaContainer = document.querySelector('.textarea-container');
const readFsToggle = document.getElementById('readFsToggle');
const readFsIcon = document.getElementById('readFsIcon');

const ICON_EXPAND = 'expand.svg';
const ICON_COLLAPSE = 'collapse.svg';

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

newFileBtn.addEventListener('click', () => {
    clearEditor();
    noteNameInput.focus();
    closeMenu();
});

searchNotesInput.addEventListener('input', () => renderList(filterNotes(searchNotesInput.value)));

// Initialize
loadTheme();
setEditing(true);
loadList();
applyHighlights();
autoDeleteExpiredNotes();

expirationCheckInterval = setInterval(autoDeleteExpiredNotes, 5 * 60 * 60 * 1000);

window.addEventListener('beforeunload', () => {
    if (expirationCheckInterval) clearInterval(expirationCheckInterval);
});
