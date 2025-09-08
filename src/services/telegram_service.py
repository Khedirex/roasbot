import requests
import json
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class TelegramService:
    """Serviço para envio de mensagens via Telegram Bot API"""
    
    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self.base_url = f"https://api.telegram.org/bot{bot_token}"
    
    def send_message(self, chat_id: str, text: str, parse_mode: str = "HTML") -> Dict[str, Any]:
        """
        Enviar mensagem para um chat específico
        
        Args:
            chat_id: ID do chat ou canal
            text: Texto da mensagem
            parse_mode: Modo de formatação (HTML, Markdown)
            
        Returns:
            Dict com resposta da API do Telegram
        """
        url = f"{self.base_url}/sendMessage"
        
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode
        }
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"Mensagem enviada com sucesso para chat {chat_id}")
            return {
                "success": True,
                "data": result
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Erro ao enviar mensagem para chat {chat_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"Erro inesperado ao enviar mensagem: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def send_signal_message(self, chat_id: str, game_type: str, signal_data: Dict[str, Any], 
                           custom_message: Optional[str] = None) -> Dict[str, Any]:
        """
        Enviar mensagem de sinal formatada
        
        Args:
            chat_id: ID do chat
            game_type: Tipo do jogo (mines, aviator, etc)
            signal_data: Dados do sinal
            custom_message: Mensagem personalizada (opcional)
            
        Returns:
            Dict com resposta do envio
        """
        if custom_message:
            message = custom_message
        else:
            message = self._format_default_message(game_type, signal_data)
        
        return self.send_message(chat_id, message)
    
    def _format_default_message(self, game_type: str, signal_data: Dict[str, Any]) -> str:
        """
        Formatar mensagem padrão baseada no tipo de jogo
        
        Args:
            game_type: Tipo do jogo
            signal_data: Dados do sinal
            
        Returns:
            Mensagem formatada
        """
        if game_type.lower() == "mines":
            return self._format_mines_message(signal_data)
        elif game_type.lower() == "aviator":
            return self._format_aviator_message(signal_data)
        else:
            return self._format_generic_message(signal_data)
    
    def _format_mines_message(self, signal_data: Dict[str, Any]) -> str:
        """Formatar mensagem para o jogo Mines"""
        pattern = signal_data.get('pattern', '')
        action = signal_data.get('action', '')
        confidence = signal_data.get('confidence', 0)
        
        message = f"""🎯 <b>SINAL MINES</b> 🎯

📊 Padrão detectado: {pattern}
🎲 Ação recomendada: {action}
📈 Confiança: {confidence}%

⚠️ <i>Jogue com responsabilidade!</i>
💰 <i>Gerencie sua banca adequadamente</i>

🤖 Bot automático - {signal_data.get('timestamp', '')}"""
        
        return message
    
    def _format_aviator_message(self, signal_data: Dict[str, Any]) -> str:
        """Formatar mensagem para o jogo Aviator"""
        pattern = signal_data.get('pattern', '')
        multiplier = signal_data.get('target_multiplier', '2.0x')
        confidence = signal_data.get('confidence', 0)
        
        message = f"""✈️ <b>SINAL AVIATOR</b> ✈️

📊 Padrão: {pattern}
🎯 Multiplicador alvo: {multiplier}
📈 Confiança: {confidence}%

⚠️ <i>Retire no multiplicador indicado!</i>
💰 <i>Gerencie sua banca adequadamente</i>

🤖 Bot automático - {signal_data.get('timestamp', '')}"""
        
        return message
    
    def _format_generic_message(self, signal_data: Dict[str, Any]) -> str:
        """Formatar mensagem genérica"""
        pattern = signal_data.get('pattern', '')
        action = signal_data.get('action', '')
        confidence = signal_data.get('confidence', 0)
        
        message = f"""🎯 <b>SINAL DETECTADO</b> 🎯

📊 Padrão: {pattern}
🎲 Ação: {action}
📈 Confiança: {confidence}%

⚠️ <i>Jogue com responsabilidade!</i>
💰 <i>Gerencie sua banca adequadamente</i>

🤖 Bot automático - {signal_data.get('timestamp', '')}"""
        
        return message
    
    def test_connection(self, chat_id: str) -> Dict[str, Any]:
        """
        Testar conexão com o Telegram
        
        Args:
            chat_id: ID do chat para teste
            
        Returns:
            Dict com resultado do teste
        """
        test_message = "🤖 Teste de conexão - Bot funcionando corretamente!"
        return self.send_message(chat_id, test_message)
    
    def get_bot_info(self) -> Dict[str, Any]:
        """
        Obter informações do bot
        
        Returns:
            Dict com informações do bot
        """
        url = f"{self.base_url}/getMe"
        
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            return {
                "success": True,
                "data": result
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Erro ao obter informações do bot: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"Erro inesperado ao obter informações do bot: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

