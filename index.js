// 1. КОНФИГУРАЦИЯ SUPABASE
const SUPABASE_URL = 'https://xuuyurmxkkfzwebrsfeq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_W3Xe_Qgcv-LD84TjaJ7QaA_1EkFrOwA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. DOM ЭЛЕМЕНТЫ
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const authForm = document.getElementById('auth-form');
const authMessage = document.getElementById('auth-message');
const todoListEl = document.getElementById('todo-list');
const modal = document.getElementById('modal');
const taskInput = document.getElementById('task-input');
const itemsLeftEl = document.getElementById('items-left');

// Кнопки
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const addNewBtn = document.getElementById('add-new-btn');
const saveTaskBtn = document.getElementById('save-task-btn');
const cancelTaskBtn = document.getElementById('cancel-task-btn');
const clearCompletedBtn = document.getElementById('clear-completed');
const filterBtns = document.querySelectorAll('.filter-btn');

// 3. СОСТОЯНИЕ
let currentUser = null;
let todos = [];
let currentFilter = 'all';
let editingId = null;

// 4. АВТОРИЗАЦИЯ
async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        showApp();
    } else {
        showAuth();
    }
}

// Слушатель изменений авторизации
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        showApp();
    } else {
        currentUser = null;
        showAuth();
    }
});

// Вход
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        showError(error.message);
    }
});

// Регистрация
signupBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showError("Введите email и пароль");
        return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
        showError(error.message);
    } else {
        showError("Регистрация успешна! Проверьте почту.", "green");
    }
});

// Выход
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
});

// 5. ЛОГИКА ЗАДАЧ (CRUD)

// Получение задач
async function fetchTodos() {
    if (!currentUser) return;
    
    renderLoading();

    // Требование: eq('user_id', user.id)
    const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching todos:', error);
        // Fallback на локальное состояние если API упало, но в данном случае показываем алерт
        alert('Ошибка загрузки данных');
    } else {
        todos = data || [];
        renderTodos();
    }
}

// Добавление задачи
async function addTodo(taskText) {
    const newTask = {
        task: taskText,
        user_id: currentUser.id, // Explicit setting
        completed: false
    };

    const { data, error } = await supabase
        .from('todos')
        .insert([newTask])
        .select();

    if (error) {
        alert('Ошибка добавления: ' + error.message);
    } else {
        todos.unshift(data[0]);
        renderTodos();
        closeModal();
    }
}

// Обновление (текст или статус)
async function updateTodo(id, updates) {
    // Оптимистичное обновление интерфейса
    const index = todos.findIndex(t => t.id === id);
    const oldTodo = { ...todos[index] };
    
    todos[index] = { ...todos[index], ...updates };
    renderTodos();

    const { error } = await supabase
        .from('todos')
        .update(updates)
        .eq('id', id)
        .eq('user_id', currentUser.id); // RLS check

    if (error) {
        alert('Ошибка обновления');
        todos[index] = oldTodo; // Откат
        renderTodos();
    }
}

// Удаление
async function deleteTodo(id) {
    if(!confirm('Удалить эту задачу?')) return;

    const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id);

    if (error) {
        alert('Ошибка удаления');
    } else {
        todos = todos.filter(t => t.id !== id);
        renderTodos();
    }
}

// Очистка выполненных
clearCompletedBtn.addEventListener('click', async () => {
    const completedIds = todos.filter(t => t.completed).map(t => t.id);
    
    if (completedIds.length === 0) return;

    const { error } = await supabase
        .from('todos')
        .delete()
        .in('id', completedIds)
        .eq('user_id', currentUser.id);

    if (error) {
        alert('Ошибка очистки');
    } else {
        todos = todos.filter(t => !t.completed);
        renderTodos();
    }
});

// 6. UI ФУНКЦИИ

function renderTodos() {
    todoListEl.innerHTML = '';
    
    // Фильтрация
    let filteredTodos = todos;
    if (currentFilter === 'active') filteredTodos = todos.filter(t => !t.completed);
    if (currentFilter === 'completed') filteredTodos = todos.filter(t => t.completed);

    // Счетчик
    const activeCount = todos.filter(t => !t.completed).length;
    itemsLeftEl.innerText = `${activeCount} задач осталось`;

    if (filteredTodos.length === 0) {
        todoListEl.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.6;">Задач нет</div>';
        return;
    }

    filteredTodos.forEach(todo => {
        const item = document.createElement('div');
        item.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        item.innerHTML = `
            <div class="task-info">
                <div class="task-text">${escapeHtml(todo.task)}</div>
                <div style="font-size:0.7rem; opacity:0.5;">${new Date(todo.created_at).toLocaleDateString()}</div>
            </div>
            <div class="status">
                <input type="checkbox" class="status-check" ${todo.completed ? 'checked' : ''}>
            </div>
            <div class="actions">
                <button class="edit-btn"><i class="fa-solid fa-pen"></i></button>
                <button class="delete-btn"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        // Events
        const checkbox = item.querySelector('.status-check');
        checkbox.addEventListener('change', () => updateTodo(todo.id, { completed: checkbox.checked }));

        const delBtn = item.querySelector('.delete-btn');
        delBtn.addEventListener('click', () => deleteTodo(todo.id));

        const editBtn = item.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => openModal(todo));

        todoListEl.appendChild(item);
    });
}

function renderLoading() {
    todoListEl.innerHTML = '<div class="loading">Загрузка задач...</div>';
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// 7. УПРАВЛЕНИЕ МОДАЛКОЙ И ФИЛЬТРАМИ

// Фильтры
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderTodos();
    });
});

// Модалка
addNewBtn.addEventListener('click', () => openModal());
cancelTaskBtn.addEventListener('click', closeModal);

function openModal(todoToEdit = null) {
    modal.classList.remove('hidden');
    if (todoToEdit) {
        document.getElementById('modal-title').innerText = "Редактировать задачу";
        taskInput.value = todoToEdit.task;
        editingId = todoToEdit.id;
    } else {
        document.getElementById('modal-title').innerText = "Новая задача";
        taskInput.value = '';
        editingId = null;
    }
    taskInput.focus();
}

function closeModal() {
    modal.classList.add('hidden');
    editingId = null;
}

saveTaskBtn.addEventListener('click', () => {
    const text = taskInput.value.trim();
    if (!text) {
        alert("Введите текст задачи");
        return;
    }

    if (editingId) {
        updateTodo(editingId, { task: text });
        closeModal();
    } else {
        addTodo(text);
    }
});

// Helpers
function showApp() {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    fetchTodos();
}

function showAuth() {
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    authMessage.innerText = '';
    todos = [];
}

function showError(msg, color = 'red') {
    authMessage.style.color = color;
    authMessage.innerText = msg;
}

// Инициализация
checkUser();