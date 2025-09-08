// API Base URL
const API_BASE = '/api';

// Estado global da aplicação
let appState = {
    bots: [],
    strategies: [],
    signals: [],
    stats: {
        totalBots: 0,
        totalStrategies: 0,
        totalSignals: 0,
        winRate: 0
    }
};

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadDashboardData();
});

// Inicializar aplicação
function initializeApp() {
    // Event listeners para formulários
    document.getElementById('createBotForm').addEventListener('submit', handleCreateBot);
    document.getElementById('createStrategyForm').addEventListener('submit', handleCreateStrategy);
    
    // Carregar dados iniciais
    loadBots();
    loadStrategies();
}

// Navegação entre abas
function showTab(tabName) {
    // Remover classe active de todas as abas
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Ativar aba selecionada
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    // Carregar dados específicos da aba
    switch(tabName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'bots':
            loadBots();
            break;
        case 'strategies':
            loadStrategies();
            break;
        case 'signals':
            loadSignals();
            break;
    }
}

// Gerenciamento de modais
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
    
    // Carregar dados específicos do modal
    if (modalId === 'createStrategyModal') {
        loadBotsForStrategy();
    }
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    
    // Limpar formulários
    const modal = document.getElementById(modalId);
    const forms = modal.querySelectorAll('form');
    forms.forEach(form => form.reset());
}

// Carregar dados do dashboard
async function loadDashboardData() {
    try {
        // Carregar estatísticas
        await Promise.all([
            loadBots(),
            loadStrategies(),
            updateStats()
        ]);
        
        // Atualizar atividade recente
        updateRecentActivity();
        
    } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        showAlert('Erro ao carregar dados do dashboard', 'error');
    }
}

// Carregar robôs
async function loadBots() {
    try {
        showLoading('botsList');
        
        const response = await fetch(`${API_BASE}/bots`);
        const data = await response.json();
        
        if (data.success) {
            appState.bots = data.data;
            renderBots();
            updateStats();
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Erro ao carregar robôs:', error);
        showAlert('Erro ao carregar robôs: ' + error.message, 'error');
    } finally {
        hideLoading('botsList');
    }
}

// Renderizar lista de robôs
function renderBots() {
    const container = document.getElementById('botsList');
    
    if (appState.bots.length === 0) {
        container.innerHTML = '<p>Nenhum robô cadastrado ainda.</p>';
        return;
    }
    
    const html = `
        <table class="table">
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Jogo</th>
                    <th>Cassino</th>
                    <th>Status</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${appState.bots.map(bot => `
                    <tr>
                        <td><strong>${bot.name}</strong></td>
                        <td>${bot.game_type.toUpperCase()}</td>
                        <td>${bot.casino_site}</td>
                        <td>
                            <span class="status-badge ${bot.is_active ? 'status-active' : 'status-inactive'}">
                                ${bot.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                        </td>
                        <td>${formatDate(bot.created_at)}</td>
                        <td>
                            <button class="btn btn-info" onclick="testBotTelegram(${bot.id})">
                                <i class="fab fa-telegram"></i> Testar
                            </button>
                            <button class="btn btn-warning" onclick="editBot(${bot.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger" onclick="deleteBot(${bot.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// Carregar estratégias
async function loadStrategies() {
    try {
        showLoading('strategiesList');
        
        // Como não temos endpoint específico para todas as estratégias,
        // vamos carregar as estratégias de cada bot
        const strategies = [];
        
        for (const bot of appState.bots) {
            const response = await fetch(`${API_BASE}/bots/${bot.id}/strategies`);
            const data = await response.json();
            
            if (data.success) {
                strategies.push(...data.data.map(s => ({...s, bot_name: bot.name})));
            }
        }
        
        appState.strategies = strategies;
        renderStrategies();
        updateStats();
        
    } catch (error) {
        console.error('Erro ao carregar estratégias:', error);
        showAlert('Erro ao carregar estratégias: ' + error.message, 'error');
    } finally {
        hideLoading('strategiesList');
    }
}

// Renderizar lista de estratégias
function renderStrategies() {
    const container = document.getElementById('strategiesList');
    
    if (appState.strategies.length === 0) {
        container.innerHTML = '<p>Nenhuma estratégia cadastrada ainda.</p>';
        return;
    }
    
    const html = `
        <table class="table">
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Robô</th>
                    <th>Padrão</th>
                    <th>Win Rate</th>
                    <th>Sinais</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${appState.strategies.map(strategy => `
                    <tr>
                        <td><strong>${strategy.name}</strong></td>
                        <td>${strategy.bot_name}</td>
                        <td>${strategy.pattern}</td>
                        <td>${strategy.win_rate}%</td>
                        <td>${strategy.total_signals}</td>
                        <td>
                            <span class="status-badge ${strategy.is_active ? 'status-active' : 'status-inactive'}">
                                ${strategy.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-warning" onclick="resetStrategyStats(${strategy.id})">
                                <i class="fas fa-undo"></i> Reset
                            </button>
                            <button class="btn btn-danger" onclick="deleteStrategy(${strategy.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// Carregar sinais
async function loadSignals() {
    try {
        showLoading('signalsList');
        
        // Simular carregamento de sinais (implementar endpoint específico)
        const html = `
            <div class="card">
                <h3>Últimos Sinais Enviados</h3>
                <p>Funcionalidade em desenvolvimento. Use "Simular Análise" para testar o sistema.</p>
            </div>
        `;
        
        document.getElementById('signalsList').innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar sinais:', error);
        showAlert('Erro ao carregar sinais: ' + error.message, 'error');
    } finally {
        hideLoading('signalsList');
    }
}

// Criar novo robô
async function handleCreateBot(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const botData = {
        name: document.getElementById('botName').value,
        game_type: document.getElementById('gameType').value,
        casino_site: document.getElementById('casinoSite').value,
        telegram_token: document.getElementById('telegramToken').value,
        telegram_chat_id: document.getElementById('telegramChatId').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/bots`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(botData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Robô criado com sucesso!', 'success');
            hideModal('createBotModal');
            loadBots();
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Erro ao criar robô:', error);
        showAlert('Erro ao criar robô: ' + error.message, 'error');
    }
}

// Criar nova estratégia
async function handleCreateStrategy(event) {
    event.preventDefault();
    
    const strategyData = {
        name: document.getElementById('strategyName').value,
        bot_id: parseInt(document.getElementById('strategyBotId').value),
        pattern: document.getElementById('strategyPattern').value,
        action: document.getElementById('strategyAction').value,
        start_time: document.getElementById('strategyStartTime').value,
        end_time: document.getElementById('strategyEndTime').value,
        custom_message: document.getElementById('strategyMessage').value,
        use_default_message: !document.getElementById('strategyMessage').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/strategies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(strategyData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Estratégia criada com sucesso!', 'success');
            hideModal('createStrategyModal');
            loadStrategies();
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Erro ao criar estratégia:', error);
        showAlert('Erro ao criar estratégia: ' + error.message, 'error');
    }
}

// Carregar robôs para seleção na estratégia
async function loadBotsForStrategy() {
    const select = document.getElementById('strategyBotId');
    select.innerHTML = '<option value="">Selecione um robô...</option>';
    
    appState.bots.forEach(bot => {
        const option = document.createElement('option');
        option.value = bot.id;
        option.textContent = `${bot.name} (${bot.game_type})`;
        select.appendChild(option);
    });
}

// Simular jogo
async function simulateGame() {
    try {
        const response = await fetch(`${API_BASE}/signals/simulate-game`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                game_type: 'aviator'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const message = `Simulação executada! ${data.data.signals_sent} sinais enviados.`;
            showAlert(message, 'success');
            loadDashboardData();
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Erro na simulação:', error);
        showAlert('Erro na simulação: ' + error.message, 'error');
    }
}

// Testar Telegram
async function testTelegram() {
    if (appState.bots.length === 0) {
        showAlert('Crie um robô primeiro para testar o Telegram', 'error');
        return;
    }
    
    const bot = appState.bots[0];
    await testBotTelegram(bot.id);
}

// Testar Telegram de um robô específico
async function testBotTelegram(botId) {
    const bot = appState.bots.find(b => b.id === botId);
    if (!bot) return;
    
    try {
        const response = await fetch(`${API_BASE}/signals/test-telegram`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bot_token: bot.telegram_token,
                chat_id: bot.telegram_chat_id
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Teste do Telegram realizado com sucesso!', 'success');
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Erro no teste do Telegram:', error);
        showAlert('Erro no teste do Telegram: ' + error.message, 'error');
    }
}

// Resetar estatísticas de estratégia
async function resetStrategyStats(strategyId) {
    if (!confirm('Tem certeza que deseja zerar as estatísticas desta estratégia?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/strategies/${strategyId}/reset-stats`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Estatísticas zeradas com sucesso!', 'success');
            loadStrategies();
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Erro ao zerar estatísticas:', error);
        showAlert('Erro ao zerar estatísticas: ' + error.message, 'error');
    }
}

// Deletar robô
async function deleteBot(botId) {
    if (!confirm('Tem certeza que deseja deletar este robô? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/bots/${botId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Robô deletado com sucesso!', 'success');
            loadBots();
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Erro ao deletar robô:', error);
        showAlert('Erro ao deletar robô: ' + error.message, 'error');
    }
}

// Atualizar estatísticas
function updateStats() {
    const activeBots = appState.bots.filter(bot => bot.is_active).length;
    const activeStrategies = appState.strategies.filter(s => s.is_active).length;
    const totalSignals = appState.strategies.reduce((sum, s) => sum + s.total_signals, 0);
    const totalWins = appState.strategies.reduce((sum, s) => sum + s.wins, 0);
    const winRate = totalSignals > 0 ? Math.round((totalWins / totalSignals) * 100) : 0;
    
    document.getElementById('totalBots').textContent = activeBots;
    document.getElementById('totalStrategies').textContent = activeStrategies;
    document.getElementById('totalSignals').textContent = totalSignals;
    document.getElementById('winRate').textContent = winRate + '%';
}

// Atualizar atividade recente
function updateRecentActivity() {
    const container = document.getElementById('recentActivity');
    
    const activities = [
        'Sistema iniciado com sucesso',
        `${appState.bots.length} robôs carregados`,
        `${appState.strategies.length} estratégias ativas`,
        'Monitoramento em tempo real ativo'
    ];
    
    const html = activities.map(activity => 
        `<div style="padding: 10px; border-left: 3px solid #667eea; margin-bottom: 10px; background: rgba(102, 126, 234, 0.05);">
            <i class="fas fa-info-circle" style="color: #667eea; margin-right: 8px;"></i>
            ${activity}
        </div>`
    ).join('');
    
    container.innerHTML = html;
}

// Salvar configurações
function saveSettings() {
    const settings = {
        analysisInterval: document.getElementById('analysisInterval').value,
        debugMode: document.getElementById('debugMode').value === 'true'
    };
    
    localStorage.setItem('casinoSignalsSettings', JSON.stringify(settings));
    showAlert('Configurações salvas com sucesso!', 'success');
}

// Atualizar sinais
function refreshSignals() {
    loadSignals();
    showAlert('Sinais atualizados!', 'success');
}

// Utilitários
function showAlert(message, type = 'success') {
    const modal = document.getElementById('alertModal');
    const title = document.getElementById('alertTitle');
    const messageEl = document.getElementById('alertMessage');
    
    title.textContent = type === 'success' ? 'Sucesso' : 'Erro';
    messageEl.textContent = message;
    
    modal.style.display = 'block';
    
    // Auto-hide após 3 segundos para mensagens de sucesso
    if (type === 'success') {
        setTimeout(() => {
            hideModal('alertModal');
        }, 3000);
    }
}

function showLoading(containerId) {
    const container = document.getElementById(containerId);
    const loading = container.querySelector('.loading');
    if (loading) {
        loading.style.display = 'block';
    }
}

function hideLoading(containerId) {
    const container = document.getElementById(containerId);
    const loading = container.querySelector('.loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Fechar modais clicando fora
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

