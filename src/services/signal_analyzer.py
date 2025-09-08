import json
import random
from datetime import datetime, time
from typing import Dict, List, Any, Optional, Tuple
import logging
from collections import deque

logger = logging.getLogger(__name__)

class SignalAnalyzer:
    """Analisador de sinais para jogos de cassino"""
    
    def __init__(self):
        self.game_history = {}  # Histórico por tipo de jogo
        self.pattern_cache = {}  # Cache de padrões detectados
        
    def analyze_game_data(self, game_type: str, game_data: Dict[str, Any], 
                         strategies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analisar dados do jogo e detectar sinais baseados nas estratégias
        
        Args:
            game_type: Tipo do jogo (mines, aviator, etc)
            game_data: Dados atuais do jogo
            strategies: Lista de estratégias ativas
            
        Returns:
            Lista de sinais detectados
        """
        signals = []
        
        # Atualizar histórico
        self._update_game_history(game_type, game_data)
        
        # Analisar cada estratégia
        for strategy in strategies:
            if not strategy.get('is_active', True):
                continue
                
            # Verificar horário de funcionamento
            if not self._is_strategy_active_time(strategy):
                continue
            
            # Detectar padrão
            signal = self._detect_pattern_signal(game_type, strategy, game_data)
            if signal:
                signals.append(signal)
        
        return signals
    
    def _update_game_history(self, game_type: str, game_data: Dict[str, Any]):
        """Atualizar histórico do jogo"""
        if game_type not in self.game_history:
            self.game_history[game_type] = deque(maxlen=100)  # Manter últimos 100 resultados
        
        self.game_history[game_type].append({
            'timestamp': datetime.now().isoformat(),
            'data': game_data
        })
    
    def _is_strategy_active_time(self, strategy: Dict[str, Any]) -> bool:
        """Verificar se a estratégia está ativa no horário atual"""
        start_time = strategy.get('start_time')
        end_time = strategy.get('end_time')
        
        if not start_time or not end_time:
            return True  # Sem restrição de horário
        
        try:
            current_time = datetime.now().time()
            start = time.fromisoformat(start_time)
            end = time.fromisoformat(end_time)
            
            if start <= end:
                return start <= current_time <= end
            else:  # Horário que cruza meia-noite
                return current_time >= start or current_time <= end
                
        except Exception as e:
            logger.error(f"Erro ao verificar horário da estratégia: {str(e)}")
            return True
    
    def _detect_pattern_signal(self, game_type: str, strategy: Dict[str, Any], 
                              current_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Detectar sinal baseado no padrão da estratégia"""
        pattern = strategy.get('pattern', '')
        action = strategy.get('action', '')
        
        if game_type.lower() == 'mines':
            return self._analyze_mines_pattern(pattern, action, strategy, current_data)
        elif game_type.lower() == 'aviator':
            return self._analyze_aviator_pattern(pattern, action, strategy, current_data)
        else:
            return self._analyze_generic_pattern(pattern, action, strategy, current_data)
    
    def _analyze_mines_pattern(self, pattern: str, action: str, strategy: Dict[str, Any], 
                              current_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Analisar padrão para o jogo Mines"""
        history = self.game_history.get('mines', [])
        
        if len(history) < 3:
            return None  # Histórico insuficiente
        
        # Exemplo de análise de padrão: "red-red-black" = apostar no vermelho
        # Simulação de detecção de padrão baseada nos últimos resultados
        last_results = [item['data'].get('result', 'unknown') for item in list(history)[-3:]]
        
        # Lógica simplificada de detecção de padrão
        if self._matches_pattern(pattern, last_results):
            confidence = self._calculate_confidence(pattern, history)
            
            return {
                'strategy_id': strategy['id'],
                'game_type': 'mines',
                'pattern': pattern,
                'action': action,
                'confidence': confidence,
                'timestamp': datetime.now().isoformat(),
                'signal_data': {
                    'last_results': last_results,
                    'recommended_action': action,
                    'target_multiplier': '2.0x'
                }
            }
        
        return None
    
    def _analyze_aviator_pattern(self, pattern: str, action: str, strategy: Dict[str, Any], 
                                current_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Analisar padrão para o jogo Aviator"""
        history = self.game_history.get('aviator', [])
        
        if len(history) < 5:
            return None
        
        # Análise de multiplicadores baixos consecutivos
        last_multipliers = [float(item['data'].get('multiplier', 1.0)) for item in list(history)[-5:]]
        
        # Detectar sequência de multiplicadores baixos (possível sinal para multiplicador alto)
        low_multipliers = [m for m in last_multipliers if m < 2.0]
        
        if len(low_multipliers) >= 3:  # 3 ou mais multiplicadores baixos consecutivos
            confidence = min(85, 50 + len(low_multipliers) * 10)
            
            return {
                'strategy_id': strategy['id'],
                'game_type': 'aviator',
                'pattern': f"Sequência de {len(low_multipliers)} multiplicadores baixos",
                'action': action,
                'confidence': confidence,
                'timestamp': datetime.now().isoformat(),
                'signal_data': {
                    'last_multipliers': last_multipliers,
                    'recommended_action': action,
                    'target_multiplier': '2.5x'
                }
            }
        
        return None
    
    def _analyze_generic_pattern(self, pattern: str, action: str, strategy: Dict[str, Any], 
                                current_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Análise genérica de padrão"""
        # Implementação básica para outros tipos de jogos
        confidence = random.randint(60, 85)  # Simulação de confiança
        
        return {
            'strategy_id': strategy['id'],
            'game_type': 'generic',
            'pattern': pattern,
            'action': action,
            'confidence': confidence,
            'timestamp': datetime.now().isoformat(),
            'signal_data': {
                'recommended_action': action,
                'pattern_detected': pattern
            }
        }
    
    def _matches_pattern(self, pattern: str, results: List[str]) -> bool:
        """Verificar se os resultados correspondem ao padrão"""
        # Implementação simplificada de correspondência de padrão
        pattern_parts = pattern.lower().split('-')
        
        if len(pattern_parts) != len(results):
            return False
        
        for i, part in enumerate(pattern_parts):
            if part not in results[i].lower():
                return False
        
        return True
    
    def _calculate_confidence(self, pattern: str, history: List[Dict[str, Any]]) -> int:
        """Calcular nível de confiança do sinal"""
        # Implementação básica de cálculo de confiança
        base_confidence = 70
        
        # Ajustar baseado no histórico
        if len(history) > 50:
            base_confidence += 10
        
        # Adicionar variação aleatória para simular análise real
        variation = random.randint(-15, 15)
        confidence = max(50, min(95, base_confidence + variation))
        
        return confidence
    
    def simulate_game_data(self, game_type: str) -> Dict[str, Any]:
        """
        Simular dados de jogo para teste (remover em produção)
        
        Args:
            game_type: Tipo do jogo
            
        Returns:
            Dados simulados do jogo
        """
        if game_type.lower() == 'mines':
            return {
                'result': random.choice(['red', 'black', 'green']),
                'multiplier': round(random.uniform(1.1, 5.0), 2),
                'timestamp': datetime.now().isoformat()
            }
        elif game_type.lower() == 'aviator':
            return {
                'multiplier': round(random.uniform(1.01, 10.0), 2),
                'crashed': random.choice([True, False]),
                'timestamp': datetime.now().isoformat()
            }
        else:
            return {
                'result': random.choice(['win', 'loss']),
                'value': random.randint(1, 100),
                'timestamp': datetime.now().isoformat()
            }
    
    def get_game_statistics(self, game_type: str) -> Dict[str, Any]:
        """Obter estatísticas do jogo"""
        history = self.game_history.get(game_type, [])
        
        if not history:
            return {'total_games': 0, 'recent_results': []}
        
        return {
            'total_games': len(history),
            'recent_results': [item['data'] for item in list(history)[-10:]],
            'last_update': history[-1]['timestamp'] if history else None
        }

