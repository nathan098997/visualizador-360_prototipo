// Configuração dos projetos com persistência em localStorage
const STORAGE_KEY = 'vj360_projects';
const DEFAULT_PROJECTS = {
    'projeto-demo': {
        password: '123456',
        image: 'https://cdn.pannellum.org/2.5/example/examplepano.jpg',
        title: 'Projeto Demo',
        createdAt: new Date().toISOString()
    },
    'casa-modelo': {
        password: 'casa2024',
        image: 'https://cdn.pannellum.org/2.5/example/examplepano.jpg',
        title: 'Casa Modelo',
        createdAt: new Date().toISOString()
    },
    'apartamento-luxo': {
        password: 'luxo789',
        image: 'https://cdn.pannellum.org/2.5/example/examplepano.jpg',
        title: 'Apartamento de Luxo',
        createdAt: new Date().toISOString()
    }
};

function loadProjects() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_PROJECTS };
        return JSON.parse(raw);
    } catch (e) {
        console.warn('Falha ao carregar projetos do localStorage, usando padrão.', e);
        return { ...DEFAULT_PROJECTS };
    }
}

function saveProjects() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
        console.error('Falha ao salvar projetos.', e);
    }
}

let projects = loadProjects();

const ADMIN_PASSWORD = 'admin123';
let viewer = null;
let previewViewer = null;
let hotspots = [];
let addingHotspot = false;
let editingHotspot = null;
let currentParentId = null;
let previewClickBound = false;
let previewCurrentImage = null;
let previewRootImage = null;
let editingProjectName = null;

// Toggle entre modo usuário e admin
document.getElementById('modeToggle').addEventListener('change', function() {
    if (this.checked) {
        showAdminMode();
    } else {
        showUserMode();
    }
});

// Login usuário
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const projectNameRaw = document.getElementById('projectName').value.trim();
    const projectName = slugify(projectNameRaw);
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');
    
    if (projects[projectName] && projects[projectName].password === password) {
        errorDiv.classList.add('hidden');
        showViewer(projectName);
    } else {
        errorDiv.textContent = 'Nome do projeto ou senha incorretos!';
        errorDiv.classList.remove('hidden');
    }
});

// Login admin
document.getElementById('adminForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('errorMessage');
    
    if (password === ADMIN_PASSWORD) {
        errorDiv.classList.add('hidden');
        showAdminPanel();
    } else {
        errorDiv.textContent = 'Senha de admin incorreta!';
        errorDiv.classList.remove('hidden');
    }
});

// Preview da imagem
document.getElementById('imageUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            showImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        hideImagePreview();
    }
});

// Controles de hotspot
document.getElementById('addHotspotBtn').addEventListener('click', function() {
    setAddHotspotMode(true);
});

document.getElementById('removeHotspotBtn').addEventListener('click', function() {
    hotspots = [];
    updateHotspotsList();
    if (previewViewer) {
        previewViewer.removeAllHotSpots();
    }
});

// Criar novo projeto
document.getElementById('createProjectForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nameRaw = document.getElementById('newProjectName').value.trim();
    const name = slugify(nameRaw);
    const password = document.getElementById('newProjectPassword').value;
    const title = document.getElementById('newProjectTitle').value.trim();
    const imageFile = document.getElementById('imageUpload').files[0];

    if (!name) {
        toast('Informe um nome de projeto.', 'warn');
        return;
    }
    if (!title) {
        toast('Informe um título.', 'warn');
        return;
    }
    
    // Se estamos editando e não há nova imagem, usar a existente
    if (editingProjectName && !imageFile) {
        const existingProject = projects[editingProjectName];
        if (existingProject) {
            // Remover projeto antigo se o nome mudou
            if (editingProjectName !== name) {
                delete projects[editingProjectName];
            }
            
            projects[name] = {
                password: password,
                image: existingProject.image,
                title: title,
                hotspots: [...hotspots],
                createdAt: existingProject.createdAt
            };
            saveProjects();
            
            toast('Projeto atualizado com sucesso!', 'ok');
            resetCreateForm();
            showSection('projects');
            updateProjectsGrid();
            return;
        }
    }
    
    if (!imageFile && !editingProjectName) {
        toast('Selecione uma imagem 360°.', 'warn');
        return;
    }
    if (projects[name] && !editingProjectName) {
        toast('Projeto já existe!', 'danger');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Remover projeto antigo se estamos editando e o nome mudou
        if (editingProjectName && editingProjectName !== name) {
            delete projects[editingProjectName];
        }
        
        const existingProject = editingProjectName ? projects[editingProjectName] : null;
        
        projects[name] = {
            password: password,
            image: e.target.result,
            title: title,
            hotspots: [...hotspots],
            createdAt: existingProject ? existingProject.createdAt : new Date().toISOString()
        };
        saveProjects();
        
        const message = editingProjectName ? 'Projeto atualizado com sucesso!' : 'Projeto criado com sucesso!';
        toast(message, 'ok');
        resetCreateForm();
        showSection('projects');
        updateProjectsGrid();
    };
    reader.readAsDataURL(imageFile);
});

// Logout buttons
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('adminLogoutBtn').addEventListener('click', logout);

// Modo escuro
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    
    // Salvar preferência
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Atualizar botão
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
        btn.setAttribute('aria-pressed', isDark);
    }
}

// Carregar tema salvo
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    }
    updateThemeButton();
}

function updateThemeButton() {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        const isDark = document.body.classList.contains('dark');
        btn.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
        btn.setAttribute('aria-pressed', isDark);
    }
}

// Carregar tema ao iniciar
loadTheme();

function showViewer(projectName) {
    const project = projects[projectName];
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('viewerContainer').classList.remove('hidden');
    document.getElementById('projectTitle').textContent = project.title;

    try {
        viewer = pannellum.viewer('panorama', {
            type: 'equirectangular',
            panorama: project.image,
            autoLoad: true,
            autoRotate: -2,
            compass: true,
            showZoomCtrl: true,
            showFullscreenCtrl: true
        });
    } catch (e) {
        console.error('Erro ao iniciar viewer:', e);
        toast('Não foi possível carregar o panorama.', 'danger');
    }
}

function showUserMode() {
    document.getElementById('userLogin').classList.remove('hidden');
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
}

function showAdminMode() {
    document.getElementById('userLogin').classList.add('hidden');
    document.getElementById('adminLogin').classList.remove('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
}

function showAdminPanel() {
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    showSection('projects');
    updateProjectsGrid();
}

function showSection(section) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Hide all sections
    document.getElementById('projectsSection').classList.add('hidden');
    document.getElementById('createSection').classList.add('hidden');
    
    if (section === 'projects') {
        document.getElementById('projectsSection').classList.remove('hidden');
        document.getElementById('pageTitle').textContent = 'Projetos';
        document.getElementById('pageSubtitle').textContent = 'Aqui você faz a gestão de seus projetos.';
        document.querySelectorAll('.nav-item')[0].classList.add('active');
        resetCreateForm();
    } else if (section === 'create') {
        document.getElementById('createSection').classList.remove('hidden');
        if (!editingProjectName) {
            document.getElementById('pageTitle').textContent = 'Criar Projeto';
            document.getElementById('pageSubtitle').textContent = 'Configure um novo projeto 360°.';
            document.getElementById('submitProjectBtn').textContent = 'Criar Projeto';
        }
        document.querySelectorAll('.nav-item')[1].classList.add('active');
    }
}

function resetCreateForm() {
    editingProjectName = null;
    document.getElementById('createProjectForm').reset();
    hideImagePreview();
    hotspots = [];
    document.getElementById('pageTitle').textContent = 'Criar Projeto';
    document.getElementById('pageSubtitle').textContent = 'Configure um novo projeto 360°.';
    document.getElementById('submitProjectBtn').textContent = 'Criar Projeto';
}

function updateProjectsGrid() {
    const grid = document.getElementById('projectsGrid');
    const emptyState = document.getElementById('emptyState');
    grid.innerHTML = '';
    
    const projectEntries = Object.entries(projects);
    
    if (projectEntries.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    projectEntries.forEach(([name, project]) => {
        const createdDate = new Date(project.createdAt).toLocaleDateString('pt-BR');
        const hotspotCount = project.hotspots ? project.hotspots.length : 0;
        
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <div class="project-thumbnail">
                <img src="${project.image}" alt="${project.title}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px 8px 0 0;">
            </div>
            <div class="project-info">
                <div class="project-name">${project.title}</div>
                <div class="project-meta">Tour Virtual 360° • ${createdDate} • ${hotspotCount} pontos</div>
                <div class="project-actions">
                    <button class="btn-sm btn-view" onclick="previewProject('${name}')">👁️ Ver</button>
                    <button class="btn-sm btn-edit" onclick="editProject('${name}')">✏️ Editar</button>
                    <button class="btn-sm btn-delete" onclick="deleteProject('${name}')">🗑️ Excluir</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function editProject(name) {
    const project = projects[name];
    if (!project) return;
    
    editingProjectName = name;
    
    // Preencher formulário com dados existentes
    document.getElementById('newProjectName').value = name;
    document.getElementById('newProjectPassword').value = project.password;
    document.getElementById('newProjectTitle').value = project.title;
    
    // Mostrar preview da imagem existente
    if (project.image) {
        showImagePreview(project.image);
        // Carregar hotspots existentes
        hotspots = project.hotspots ? [...project.hotspots] : [];
        setTimeout(() => {
            updateHotspotsList();
        }, 1000);
    }
    
    // Alterar título da seção
    document.getElementById('pageTitle').textContent = 'Editar Projeto';
    document.getElementById('pageSubtitle').textContent = 'Modifique as configurações do projeto.';
    document.getElementById('submitProjectBtn').textContent = 'Salvar Alterações';
    
    showSection('create');
}

function previewProject(name) {
    showViewer(name);
}

function deleteProject(name) {
    if (confirm(`Excluir projeto "${projects[name].title}"?`)) {
        delete projects[name];
        saveProjects();
        updateProjectsGrid();
        toast('Projeto excluído.', 'ok');
    }
}

function showImagePreview(imageSrc) {
    document.getElementById('imagePreview').classList.remove('hidden');
    currentParentId = null;
    previewClickBound = false;
    previewCurrentImage = imageSrc;
    previewRootImage = imageSrc;

    if (previewViewer) {
        previewViewer.destroy();
    }

    setTimeout(() => {
        previewViewer = pannellum.viewer('previewPanorama', {
            type: 'equirectangular',
            panorama: previewCurrentImage,
            autoLoad: true,
            showZoomCtrl: false,
            showFullscreenCtrl: false
        });
    }, 100);
}

function hideImagePreview() {
    document.getElementById('imagePreview').classList.add('hidden');
    if (previewViewer) {
        previewViewer.destroy();
        previewViewer = null;
    }
    hotspots = [];
    addingHotspot = false;
}

function updateHotspotsList() {
    const list = document.getElementById('hotspotsList');
    list.innerHTML = '';

    const currentList = hotspots.filter(h => (h.parentId || null) === (currentParentId || null));

    if (currentList.length === 0) {
        const p = document.createElement('p');
        p.className = 'hotspot-empty muted';
        p.textContent = 'Nenhum ponto adicionado nesta cena';
        list.appendChild(p);
        return;
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function showHelpModal() {
    const modal = document.getElementById('helpModal');
    modal.classList.remove('hidden');
}

function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    modal.classList.add('hidden');
}

function toggleNavigation() {
    const sidebar = document.getElementById('navSidebar');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('open');
    document.querySelectorAll('.nav-toggle, .nav-close').forEach(btn => {
        btn.setAttribute('aria-expanded', String(isOpen));
    });
}

function slugify(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function setAddHotspotMode(on) {
    const btn = document.getElementById('addHotspotBtn');
    addingHotspot = !!on;
    if (btn) {
        if (on) {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-warning');
            btn.style.background = '#fbbf24';
            btn.textContent = 'Clique na imagem';
        } else {
            btn.classList.add('btn-secondary');
            btn.style.background = '';
            btn.textContent = 'Adicionar Ponto';
        }
    }
}

function toast(msg, type = 'ok') {
    const errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) return alert(msg);
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
    setTimeout(() => errorDiv.classList.add('hidden'), 2500);
}

function logout() {
    if (viewer) {
        viewer.destroy();
        viewer = null;
    }
    
    if (previewViewer) {
        previewViewer.destroy();
        previewViewer = null;
    }
    
    document.getElementById('viewerContainer').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('loginContainer').classList.remove('hidden');
    document.getElementById('loginForm').reset();
    document.getElementById('adminForm').reset();
    document.getElementById('errorMessage').classList.add('hidden');
    document.getElementById('modeToggle').checked = false;
    resetCreateForm();
    showUserMode();
}