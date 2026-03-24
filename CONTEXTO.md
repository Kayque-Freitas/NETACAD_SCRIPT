# NetAcad AI Quiz Answerer — Contexto do Projeto

Userscript Tampermonkey que detecta automaticamente quizzes no Cisco NetAcad, consulta uma IA e seleciona a resposta correta sem intervenção humana.

---

## Instalação

### 1. Instale o Tampermonkey
| Navegador | Link |
|-----------|------|
| Chrome | https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo |
| Firefox | https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/ |
| Edge | https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd |

### 2. Instale o script

**Via servidor local (recomendado):**
1. Coloque o arquivo `netacad_quiz_ai.user.js` na pasta raiz do seu servidor local (ex: Laragon/XAMPP)
2. Abra `http://localhost/netacad/netacad_quiz_ai.user.js` no navegador
3. O Tampermonkey detecta o `.user.js` automaticamente — clique em **Instalar**

**Via painel do Tampermonkey:**
1. Clique no ícone do Tampermonkey → **Dashboard**
2. Aba **+** → apague o conteúdo padrão
3. Cole o conteúdo de `netacad_quiz_ai.user.js` → `Ctrl+S`

> **Nota:** Abrir o arquivo diretamente pelo sistema de arquivos (`file:///...`) é bloqueado pelo Chrome. Use sempre o servidor local ou o painel do Tampermonkey.

---

## Configuração da Chave de API

O script requer uma chave de API de um dos providers suportados:

| Provider | Custo | Modelo recomendado | Link |
|----------|-------|--------------------|------|
| **Google Gemini** ⭐ | Gratuito | `gemini-2.0-flash` | https://aistudio.google.com/app/apikey |
| **Groq** | Gratuito | `llama3-70b-8192` | https://console.groq.com/keys |
| OpenAI | Pago | `gpt-4o-mini` | https://platform.openai.com/api-keys |

Após obter a chave:
1. Acesse o NetAcad e faça login
2. Clique em **⚙️** no painel flutuante (canto inferior direito)
3. Selecione o **Provider**, o **Modelo** e cole a **Chave de API**
4. Clique em **💾 Salvar configurações**

**Alternativa — hardcoded no código:**
Encontre a linha abaixo no arquivo e substitua `''` pela sua chave:
```js
get apiKey() { return GM_getValue('apiKey', 'SUA_CHAVE_AQUI'); },
```

---

## Como Funciona

```
1. MutationObserver monitora mudanças no DOM da página
2. Ao detectar input[type=radio] com 2+ opções → quiz encontrado
3. Extrai a pergunta subindo na árvore DOM (acima dos radio inputs)
4. Extrai o texto de cada opção via: label pai, aria-label, label[for], sibling span
5. Envia pergunta + opções para a IA (prompt em português, resposta em JSON)
6. IA retorna: { correct_index, correct_text, explanation }
7. Destaca a opção correta em verde; as erradas em vermelho
8. Após ~1,2s, clica automaticamente na opção correta
```

### Suporte a iframes
O script escaneia todos os `<iframe>` da página além do documento principal, cobrindo casos onde o player do NetAcad carrega em frame separado.

---

## Painel de Controle

O painel flutuante **🤖 NetAcad AI** aparece no canto inferior direito com:

| Elemento | Descrição |
|----------|-----------|
| Dot amarelo piscando | Monitorando (nenhum quiz detectado) |
| Dot roxo piscando | Consultando a IA |
| Dot verde | Resposta encontrada e selecionada |
| Dot vermelho | Erro (chave inválida, rede, etc.) |
| ⚙️ Engrenagem | Abre configurações |
| 🔍 Debug DOM | Mostra quantos radios/opções foram encontrados |
| 🔄 Reanalisar | Força nova consulta à IA para a mesma questão |
| — | Minimiza o painel |

---

## Estrutura do Projeto

```
netacad/
├── netacad_quiz_ai.user.js   ← Script principal (instalar no Tampermonkey)
└── CONTEXTO.md               ← Este arquivo
```

---

## Versões

| Versão | Mudanças |
|--------|----------|
| 2.1 | Fix no-loop-func ESLint; guard contra painel duplicado |
| 2.0 | Reescrita completa da detecção (radio-input anchored); suporte Gemini 2.0; botão Debug DOM |
| 1.0 | Versão inicial com seletores CSS fixos |

---

## Providers Suportados

### Google Gemini
```
URL: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
Modelos: gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro
```

### Groq (OpenAI-compatible)
```
URL: https://api.groq.com/openai/v1/chat/completions
Modelos: llama3-70b-8192, llama3-8b-8192, mixtral-8x7b-32768
```

### OpenAI
```
URL: https://api.openai.com/v1/chat/completions
Modelos: gpt-4o-mini, gpt-4o, gpt-3.5-turbo
```

---

## Troubleshooting

**Painel duplicado:** O script foi instalado duas vezes no Tampermonkey. Abra o Dashboard e remova a cópia duplicada.

**"Nenhum quiz detectado":** Clique em ⚙️ → 🔍 Debug DOM. Se mostrar `Radios: 0`, o quiz pode estar em um iframe cross-origin (limitação do navegador). Tente recarregar a página dentro do quiz.

**Erro de API:** Verifique se a chave está correta e se o provider está com o serviço ativo. O Gemini e Groq têm limites gratuitos — aguarde alguns minutos se receber erro 429.

**Script não carrega:** Confirme que o Tampermonkey está habilitado para a URL `netacad.com` no dashboard da extensão.
