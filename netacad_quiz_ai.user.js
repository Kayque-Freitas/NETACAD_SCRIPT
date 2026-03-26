// ==UserScript==
// @name         NetAcad AI Quiz Answerer
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Automatically answers NetAcad quizzes using AI (OpenAI GPT). Auto-selects the correct answer.
// @author       NetAcad AI Tool
// @match        https://www.netacad.com/*
// @match        https://*.netacad.com/*
// @match        https://*.skillsforall.com/*
// @connect      api.openai.com
// @connect      api.groq.com
// @connect      generativelanguage.googleapis.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ─────────────────────────────────────────────
    //  CONFIG  (editável pelo painel flutuante)
    // ─────────────────────────────────────────────
    const CFG = {
        get apiKey()   { return GM_getValue('apiKey', ''); },
        get model()    { return GM_getValue('model', 'gpt-4o-mini'); },
        get provider() { return GM_getValue('provider', 'openai'); },
        get autoMode() { return GM_getValue('autoMode', true); },
        get delay()    { return GM_getValue('delay', 1200); }, // ms before auto-click
    };

    const PROVIDERS = {
        openai: {
            url: 'https://api.openai.com/v1/chat/completions',
            defaultModel: 'gpt-4o-mini',
            models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
        },
        groq: {
            url: 'https://api.groq.com/openai/v1/chat/completions',
            defaultModel: 'llama3-70b-8192',
            models: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
        },
        gemini: {
            url: `https://generativelanguage.googleapis.com/v1beta/models/${GM_getValue('model','gemini-2.0-flash')}:generateContent`,
            defaultModel: 'gemini-2.0-flash',
            models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
        },
    };

    // ─────────────────────────────────────────────
    //  STYLES
    // ─────────────────────────────────────────────
    GM_addStyle(`
        #naq-panel {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 360px;
            max-height: 85vh;
            overflow-y: auto;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #e2e8f0;
            border: 1px solid #334155;
            border-radius: 16px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15);
            font-family: 'Segoe UI', system-ui, sans-serif;
            font-size: 13px;
            z-index: 2147483647;
            transition: all 0.3s ease;
        }
        #naq-panel.naq-collapsed { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; min-height: unset; }
        #naq-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            background: rgba(99,102,241,0.15);
            border-bottom: 1px solid #334155;
            border-radius: 16px 16px 0 0;
            cursor: pointer;
            user-select: none;
        }
        #naq-panel.naq-collapsed #naq-header { border-radius: 50%; border: none; padding: 0; justify-content: center; }
        #naq-panel.naq-collapsed #naq-content, #naq-panel.naq-collapsed #naq-footer { display: none; }
        .naq-logo { font-size: 18px; }
        .naq-title { font-weight: 700; font-size: 14px; color: #a5b4fc; letter-spacing: 0.5px; flex: 1; margin-left: 8px; }
        .naq-toggle-btn { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; padding: 2px 6px; }
        #naq-content { padding: 16px; }
        .naq-status-bar {
            display: flex; align-items: center; gap: 8px;
            background: rgba(15,23,42,0.5); border-radius: 8px; padding: 8px 12px;
            margin-bottom: 12px; border: 1px solid #1e293b;
        }
        .naq-dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; flex-shrink: 0; }
        .naq-dot.scanning { background: #facc15; animation: naq-pulse 1s infinite; }
        .naq-dot.thinking { background: #818cf8; animation: naq-pulse 0.6s infinite; }
        .naq-dot.done { background: #4ade80; }
        .naq-dot.error { background: #f87171; }
        @keyframes naq-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .naq-status-txt { font-size: 12px; color: #94a3b8; }
        .naq-question-box {
            background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
            border-radius: 10px; padding: 12px; margin-bottom: 12px;
            font-size: 12px; color: #cbd5e1; line-height: 1.5;
            max-height: 120px; overflow-y: auto;
        }
        .naq-question-label { font-size: 10px; text-transform: uppercase; color: #6366f1; font-weight: 700; margin-bottom: 6px; }
        .naq-answer-box {
            background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.25);
            border-radius: 10px; padding: 12px; margin-bottom: 12px;
        }
        .naq-answer-label { font-size: 10px; text-transform: uppercase; color: #4ade80; font-weight: 700; margin-bottom: 6px; }
        .naq-answer-txt { font-size: 13px; color: #86efac; font-weight: 600; line-height: 1.4; }
        .naq-explain-box {
            background: rgba(15,23,42,0.4); border-radius: 10px; padding: 12px;
            margin-bottom: 12px; font-size: 12px; color: #94a3b8; line-height: 1.5;
            max-height: 120px; overflow-y: auto;
            border: 1px solid #1e293b;
        }
        .naq-explain-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 6px; }
        .naq-btn {
            width: 100%; padding: 10px; border-radius: 8px; border: none; cursor: pointer;
            font-weight: 600; font-size: 13px; transition: all 0.2s; margin-bottom: 6px;
        }
        .naq-btn-primary { background: linear-gradient(135deg,#6366f1,#818cf8); color: white; }
        .naq-btn-primary:hover { opacity: 0.85; transform: translateY(-1px); }
        .naq-btn-secondary { background: rgba(100,116,139,0.2); color: #94a3b8; border: 1px solid #334155; }
        .naq-btn-secondary:hover { background: rgba(100,116,139,0.3); }
        .naq-settings { padding: 16px; border-top: 1px solid #1e293b; }
        .naq-settings-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 12px; }
        .naq-field { margin-bottom: 10px; }
        .naq-label { font-size: 11px; color: #64748b; margin-bottom: 4px; display: block; }
        .naq-input {
            width: 100%; box-sizing: border-box;
            background: rgba(15,23,42,0.6); border: 1px solid #334155; border-radius: 6px;
            color: #e2e8f0; padding: 7px 10px; font-size: 12px; outline: none;
        }
        .naq-input:focus { border-color: #6366f1; }
        .naq-select { width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #e2e8f0; padding: 7px 10px; font-size: 12px; outline: none; }
        .naq-toggle-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .naq-toggle-row span { font-size: 12px; color: #94a3b8; }
        .naq-switch { position: relative; width: 40px; height: 22px; }
        .naq-switch input { display: none; }
        .naq-slider { position: absolute; inset: 0; background: #334155; border-radius: 22px; cursor: pointer; transition: 0.3s; }
        .naq-slider:before { content:''; position: absolute; width: 16px; height: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
        .naq-switch input:checked + .naq-slider { background: #6366f1; }
        .naq-switch input:checked + .naq-slider:before { transform: translateX(18px); }
        .naq-badge {
            display: inline-block; font-size: 10px; padding: 2px 7px; border-radius: 20px;
            background: rgba(99,102,241,0.2); color: #a5b4fc; font-weight: 600;
        }
        .naq-highlight-correct { outline: 3px solid #4ade80 !important; background: rgba(74,222,128,0.12) !important; border-radius: 4px !important; transition: all 0.4s; }
        .naq-highlight-wrong   { outline: 2px solid #f87171 !important; background: rgba(248,113,113,0.07) !important; border-radius: 4px !important; }
        #naq-footer { padding: 10px 16px; border-top: 1px solid #0f172a; display: flex; align-items: center; gap: 6px; }
        .naq-footer-txt { font-size: 10px; color: #334155; }
        #naq-settings-panel { display: none; }
        #naq-settings-panel.open { display: block; }
    `);

    // ─────────────────────────────────────────────
    //  BUILD UI
    // ─────────────────────────────────────────────
    function buildPanel() {
        const panel = document.createElement('div');
        panel.id = 'naq-panel';
        panel.innerHTML = `
            <div id="naq-header">
                <span class="naq-logo">🤖</span>
                <span class="naq-title">NetAcad AI <span class="naq-badge">AUTO</span></span>
                <button class="naq-toggle-btn" id="naq-settings-toggle" title="Configurações">⚙️</button>
                <button class="naq-toggle-btn" id="naq-collapse-btn" title="Minimizar">—</button>
            </div>
            <div id="naq-content">
                <div class="naq-status-bar">
                    <div class="naq-dot scanning" id="naq-dot"></div>
                    <span class="naq-status-txt" id="naq-status">Monitorando página...</span>
                </div>
                <div id="naq-question-section" style="display:none">
                    <div class="naq-question-box">
                        <div class="naq-question-label">📋 Pergunta detectada</div>
                        <div id="naq-question-txt"></div>
                    </div>
                    <div id="naq-answer-section" style="display:none">
                        <div class="naq-answer-box">
                            <div class="naq-answer-label">✅ Resposta correta</div>
                            <div class="naq-answer-txt" id="naq-answer-txt"></div>
                        </div>
                        <div class="naq-explain-box">
                            <div class="naq-explain-label">💡 Explicação</div>
                            <div id="naq-explain-txt"></div>
                        </div>
                        <button class="naq-btn naq-btn-secondary" id="naq-rescan-btn">🔄 Reanalisar questão</button>
                    </div>
                </div>
            </div>
            <div id="naq-footer">
                <span class="naq-footer-txt">NetAcad AI v2.0 • auto-mode</span>
            </div>
            <div id="naq-settings-panel">
                <div class="naq-settings">
                    <div class="naq-settings-title">⚙️ Configurações</div>
                    <div class="naq-field">
                        <label class="naq-label">Provider de IA</label>
                        <select class="naq-select" id="naq-provider">
                            <option value="openai">OpenAI (GPT)</option>
                            <option value="groq">Groq (LLaMA / Mixtral — Grátis)</option>
                            <option value="gemini">Google Gemini</option>
                        </select>
                    </div>
                    <div class="naq-field">
                        <label class="naq-label">Modelo</label>
                        <select class="naq-select" id="naq-model-select">
                            <option value="gpt-4o-mini">gpt-4o-mini</option>
                        </select>
                    </div>
                    <div class="naq-field">
                        <button class="naq-btn naq-btn-secondary" id="naq-debug-btn" style="margin-top:4px">🔍 Debug DOM</button>
                    </div>
                    <div class="naq-field">
                        <label class="naq-label">Chave de API</label>
                        <input class="naq-input" type="password" id="naq-apikey" placeholder="sk-... ou AIza... ou gsk_..." />
                    </div>
                    <div class="naq-toggle-row">
                        <span>Selecionar resposta automaticamente</span>
                        <label class="naq-switch">
                            <input type="checkbox" id="naq-auto-toggle" ${CFG.autoMode ? 'checked' : ''} />
                            <div class="naq-slider"></div>
                        </label>
                    </div>
                    <button class="naq-btn naq-btn-primary" id="naq-save-btn">💾 Salvar configurações</button>
                </div>
            </div>
        `;
        document.body.appendChild(panel);
        initPanelEvents(panel);
        return panel;
    }

    function initPanelEvents(panel) {
        // Collapse
        document.getElementById('naq-collapse-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('naq-collapsed');
        });
        panel.addEventListener('click', () => {
            if (panel.classList.contains('naq-collapsed')) panel.classList.remove('naq-collapsed');
        });

        // Settings toggle
        document.getElementById('naq-settings-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            const sp = document.getElementById('naq-settings-panel');
            sp.classList.toggle('open');
        });

        // Provider change → update model list
        const providerSel = document.getElementById('naq-provider');
        const modelSel    = document.getElementById('naq-model-select');
        providerSel.value = CFG.provider;
        updateModelList(CFG.provider);
        modelSel.value = CFG.model;
        document.getElementById('naq-apikey').value = CFG.apiKey;

        providerSel.addEventListener('change', () => {
            updateModelList(providerSel.value);
        });

        // Save
        document.getElementById('naq-save-btn').addEventListener('click', () => {
            GM_setValue('provider', providerSel.value);
            GM_setValue('model', modelSel.value);
            GM_setValue('apiKey', document.getElementById('naq-apikey').value.trim());
            GM_setValue('autoMode', document.getElementById('naq-auto-toggle').checked);
            document.getElementById('naq-settings-panel').classList.remove('open');
            setStatus('scanning', '✅ Configurações salvas! Monitorando...');
        });

        // Rescan
        document.getElementById('naq-rescan-btn').addEventListener('click', () => {
            scanAndAnswer(true);
        });

        // Debug: dump what the script finds in DOM
        document.getElementById('naq-debug-btn').addEventListener('click', () => {
            const info = debugDOM();
            setStatus('scanning', info);
            console.log('[NetAcad AI] DOM Debug:', info);
        });
    }

    function updateModelList(provider) {
        const modelSel = document.getElementById('naq-model-select');
        const models = PROVIDERS[provider]?.models || ['gpt-4o-mini'];
        modelSel.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
        modelSel.value = models[0];
    }

    // ─────────────────────────────────────────────
    //  STATUS HELPERS
    // ─────────────────────────────────────────────
    function setStatus(state, msg) {
        const dot = document.getElementById('naq-dot');
        const txt = document.getElementById('naq-status');
        if (!dot || !txt) return;
        dot.className = `naq-dot ${state}`;
        txt.textContent = msg;
    }

    // ─────────────────────────────────────────────
    //  QUESTION + OPTION EXTRACTION
    //  Strategy: anchor on input[type=radio] elements,
    //  which always exist in NetAcad quizzes regardless
    //  of class names. Walk UP the tree to find the
    //  question text above the group of options.
    // ─────────────────────────────────────────────

    /** Get readable label text for a radio input */
    function getRadioLabel(inp) {
        // Case 1: input is inside a <label>
        const parentLabel = inp.closest('label');
        if (parentLabel) return getCleanText(parentLabel);

        // Case 2: input has aria-label or aria-labelledby
        if (inp.getAttribute('aria-label')) return inp.getAttribute('aria-label').trim();
        const labelledBy = inp.getAttribute('aria-labelledby');
        if (labelledBy) {
            const el = document.getElementById(labelledBy);
            if (el) return getCleanText(el);
        }

        // Case 3: <label for="inputId">
        if (inp.id) {
            const lbl = document.querySelector(`label[for="${inp.id}"]`);
            if (lbl) return getCleanText(lbl);
        }

        // Case 4: next sibling span/div text node
        let sib = inp.nextElementSibling;
        while (sib) {
            const txt = sib.innerText?.trim();
            if (txt && txt.length > 1) return txt;
            sib = sib.nextElementSibling;
        }

        // Case 5: parent element text
        return inp.parentElement?.innerText?.trim() || '';
    }

    /**
     * Return clean innerText of an element,
     * stripping screenReader spans and aria-hidden nodes (icons, etc.)
     */
    function getCleanText(el) {
        if (!el) return '';
        // Prefer dedicated text-inner container (NetAcad MCQ)
        const textInner = el.querySelector('.mcq__item-text-inner, [class*="item-text-inner"]');
        const source = textInner || el;
        const clone = source.cloneNode(true);
        clone.querySelectorAll(
            '.screenReader-position-text, [class*="screenReader"], [aria-hidden="true"], material-icon, .sr-only'
        ).forEach(n => n.remove());
        return clone.innerText?.trim() || '';
    }

    /** Find the common ancestor of all radio inputs, then locate the question above them */
    function findQuestionAboveOptions(radios, ctx) {
        if (!radios.length) return null;

        let bestText = null;
        let ancestor = radios[0].parentElement;

        for (let depth = 0; depth < 12; depth++) {
            if (!ancestor || ancestor === ctx.body) break;

            const allFound = radios.every(r => ancestor.contains(r));
            if (allFound) {
                // Clone to safely extract text without mutating the page
                const clone = ancestor.cloneNode(true);
                const cloneRadios = Array.from(clone.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]'));

                if (cloneRadios.length) {
                    let limit = cloneRadios[0];
                    // Walk up to find the direct child of the clone containing our options
                    while (limit.parentElement && limit.parentElement !== clone) {
                        limit = limit.parentElement;
                    }
                    // Remove the options container and all elements that come after it
                    let curr = limit;
                    while (curr) {
                        let next = curr.nextSibling;
                        curr.remove();
                        curr = next;
                    }
                }

                const qText = getCleanText(clone);
                // If we found a meaningful amount of text above the options
                if (qText.length > 10) {
                    bestText = qText;
                    break;
                }
            }
            ancestor = ancestor.parentElement;
        }
        
        return bestText;
    }

    function extractQuestion(ctx = document) {
        // PRIORITY 0: NetAcad MCQ-specific question selectors
        const MCQ_Q_SELECTORS = [
            '[class*="mcq__question"]',
            '[class*="mcq__stem"]',
            '[class*="mcq__prompt"]',
            '[class*="question-stem"]',
            '[class*="QuestionStem"]',
            '[class*="questionText"]',
            '[class*="question-text"]',
            '[class*="stem"]',
            '.prompt', '[class*="prompt"]',
            '[data-testid*="question"]',
        ];
        for (const sel of MCQ_Q_SELECTORS) {
            try {
                const el = ctx.querySelector(sel);
                if (el) {
                    const txt = getCleanText(el);
                    if (txt.length > 10) return txt;
                }
            } catch(e) {}
        }

        // PRIORITY 1: radio-input anchored question finding
        const radios = Array.from(ctx.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]'))
            .filter(r => !r.disabled && r.getAttribute('aria-disabled') !== 'true' && !r.closest('#naq-panel'));
        if (radios.length >= 2) {
            const q = findQuestionAboveOptions(radios, ctx);
            if (q && q.length > 5) return q;
        }

        // PRIORITY 2: headings
        for (const sel of ['h2', 'h3', 'h4', '[role="heading"]']) {
            try {
                const el = ctx.querySelector(sel);
                if (el) {
                    const txt = getCleanText(el);
                    if (txt.length > 10) return txt;
                }
            } catch(e) {}
        }
        return null;
    }

    function extractOptions(ctx = document) {
        // PRIORITY 0: NetAcad MCQ native structure
        // Labels: .mcq__item-label  |  Text: .mcq__item-text-inner
        // Input is OUTSIDE the label, found via label.htmlFor
        const mcqLabels = Array.from(
            ctx.querySelectorAll('.mcq__item-label, [class*="mcq__item-label"]')
        ).filter(l => !l.closest('[aria-hidden="true"]'));

        if (mcqLabels.length >= 2) {
            const seen = new Set();
            const results = [];
            for (const label of mcqLabels) {
                const txt = getCleanText(label);
                if (!txt || txt.length > 350 || seen.has(txt)) continue;
                if (/não sei|i don.t know|not sure/i.test(txt)) continue;
                seen.add(txt);
                // Input is referenced via for="..." attribute
                const inp = label.htmlFor
                    ? (ctx.getElementById?.(label.htmlFor) || document.getElementById(label.htmlFor))
                    : label.querySelector('input');
                results.push({ el: label, inp: inp || null, txt });
            }
            if (results.length >= 2) return results;
        }

        // PRIORITY 1: anchor on radio inputs
        const radios = Array.from(ctx.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]'))
            .filter(r => !r.disabled && r.getAttribute('aria-disabled') !== 'true' && !r.closest('#naq-panel'));

        if (radios.length >= 2) {
            const seen = new Set();
            const results = [];
            for (const inp of radios) {
                const txt = getRadioLabel(inp);
                if (!txt || txt.length > 350 || seen.has(txt)) continue;
                if (/não sei|i don.t know|not sure/i.test(txt)) continue;
                seen.add(txt);
                const el = inp.closest('label') || inp.parentElement;
                results.push({ el, inp, txt });
            }
            if (results.length >= 2) return results;
        }

        // PRIORITY 2: class-based option selectors
        const OPTION_SELECTORS = [
            '[class*="answer-option"]', '[class*="AnswerOption"]',
            '[class*="choice"]',       '[class*="Choice"]',
            '[role="radio"]',          'li[class*="option"]',
        ];
        for (const sel of OPTION_SELECTORS) {
            try {
                const els = Array.from(ctx.querySelectorAll(sel));
                if (els.length >= 2) {
                    const seen = new Set();
                    return els
                        .map(el => ({ el, inp: el.querySelector('input'), txt: getCleanText(el) }))
                        .filter(o => o.txt && !seen.has(o.txt) && seen.add(o.txt));
                }
            } catch(e) {}
        }
        return [];
    }

    /** Debug helper — shows what the script actually sees */
    function debugDOM(ctx = document) {
        const radios = Array.from(ctx.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]')).filter(r => !r.closest('#naq-panel'));
        const q = extractQuestion(ctx);
        const opts = extractOptions(ctx);
        return `Radios: ${radios.length} | Q: ${q ? q.substring(0,40)+'…' : 'não encontrada'} | Opts: ${opts.length}`;
    }

    // ─────────────────────────────────────────────
    //  IFRAME SCANNING
    // ─────────────────────────────────────────────
    function getAllDocuments() {
        const docs = [document];
        try {
            const frames = document.querySelectorAll('iframe');
            frames.forEach(f => {
                try { if (f.contentDocument) docs.push(f.contentDocument); } catch(e) {}
            });
        } catch(e) {}
        return docs;
    }

    // ─────────────────────────────────────────────
    //  AI QUERY
    // ─────────────────────────────────────────────
    function buildPrompt(question, options) {
        const optList = options.map((o, i) => `${i + 1}. ${o.txt}`).join('\n');
        return `Você é um especialista em cibersegurança e redes de computadores (Cisco NetAcad).
Responda estritamente em JSON com este formato:
{"correct_indices": [<array com os números 1-based das opções corretas>], "correct_text": "<texto exato da(s) opção(ões) correta(s), separadas por vírgula se mais de uma>", "explanation": "<explicação em português, máximo 2 frases>"}

PERGUNTA: ${question}

OPÇÕES:
${optList}

Responda APENAS com o JSON, sem markdown, sem code fences.`;
    }

    function queryAI(question, options) {
        return new Promise((resolve, reject) => {
            const provider = CFG.provider;
            const apiKey   = CFG.apiKey;
            const model    = CFG.model;
            const prompt   = buildPrompt(question, options);

            if (!apiKey) {
                reject('Chave de API não configurada. Abra as configurações (⚙️).');
                return;
            }

            if (provider === 'gemini') {
                // Gemini REST API
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                GM_xmlhttpRequest({
                    method: 'POST', url,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
                    }),
                    onload: (res) => {
                        try {
                            const d = JSON.parse(res.responseText);
                            const txt = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            resolve(parseAIResponse(txt.trim()));
                        } catch(e) { reject('Erro ao parsear resposta Gemini: ' + e.message); }
                    },
                    onerror: (e) => reject('Erro de rede: ' + JSON.stringify(e)),
                });
            } else {
                // OpenAI-compatible (OpenAI, Groq)
                const provCfg = PROVIDERS[provider];
                GM_xmlhttpRequest({
                    method: 'POST', url: provCfg.url,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    data: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: 'Você é um assistente especialista em Cisco NetAcad. Responda sempre em JSON puro, sem markdown.' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.1,
                        max_tokens: 512,
                    }),
                    onload: (res) => {
                        try {
                            const d = JSON.parse(res.responseText);
                            if (d.error) { reject(`Erro da API: ${d.error.message}`); return; }
                            const txt = d.choices?.[0]?.message?.content?.trim() || '';
                            resolve(parseAIResponse(txt));
                        } catch(e) { reject('Erro ao parsear resposta: ' + e.message); }
                    },
                    onerror: (e) => reject('Erro de rede: ' + JSON.stringify(e)),
                });
            }
        });
    }

    function parseAIResponse(raw) {
        // Strip possible markdown code fences
        let txt = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        // Extract JSON object
        const match = txt.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Nenhum JSON encontrado na resposta: ' + raw.substring(0, 200));
        let data = JSON.parse(match[0]);
        if (data.correct_index !== undefined && !data.correct_indices) {
            data.correct_indices = [data.correct_index];
        }
        return data;
    }

    // ─────────────────────────────────────────────
    //  CLICK / SELECT HELPERS
    // ─────────────────────────────────────────────
    function highlightElements(options, correctIndices) {
        options.forEach((o, i) => {
            o.el.classList.remove('naq-highlight-correct', 'naq-highlight-wrong');
            if (correctIndices && correctIndices.includes(i + 1)) o.el.classList.add('naq-highlight-correct');
            else o.el.classList.add('naq-highlight-wrong');
        });
    }

    function clickCorrect(options, correctIndices) {
        if (!correctIndices || !Array.isArray(correctIndices)) return;
        correctIndices.forEach(idx => {
            const target = options[idx - 1];
            if (!target) return;

            // Use the stored input reference if available (from radio-anchored extraction)
            const inp = target.inp
                     || target.el.querySelector('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]')
                     || null;

            if (inp) {
                if (inp.type === 'checkbox' && inp.checked) return;
                inp.focus();
                inp.click();
                inp.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                target.el.focus();
                target.el.click();
                target.el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            }
        });
    }

    // ─────────────────────────────────────────────
    //  MAIN SCAN + ANSWER LOGIC
    // ─────────────────────────────────────────────
    let lastQuestion = '';
    let isProcessing = false;

    async function scanAndAnswer(force = false) {
        if (isProcessing) return;

        const docs = getAllDocuments();
        let question = null;
        let options  = [];
        let foundDoc = null;

        for (const doc of docs) {
            question = extractQuestion(doc);
            if (question) {
                options  = extractOptions(doc);
                foundDoc = doc;
                break;
            }
        }

        if (!question || options.length < 2) {
            setStatus('scanning', 'Monitorando... (nenhum quiz detectado)');
            document.getElementById('naq-question-section').style.display = 'none';
            return;
        }

        // Don't re-process same question unless forced
        if (!force && question === lastQuestion) return;
        lastQuestion = question;

        // Show question
        document.getElementById('naq-question-section').style.display = 'block';
        document.getElementById('naq-answer-section').style.display = 'none';
        document.getElementById('naq-question-txt').textContent = question.length > 250
            ? question.substring(0, 250) + '…'
            : question;

        setStatus('thinking', `🧠 Consultando IA (${CFG.provider})...`);
        isProcessing = true;

        try {
            const result = await queryAI(question, options);

            document.getElementById('naq-answer-txt').textContent = result.correct_text || `Opções: ${result.correct_indices.join(', ')}`;
            document.getElementById('naq-explain-txt').textContent = result.explanation || '';
            document.getElementById('naq-answer-section').style.display = 'block';

            // Highlight
            highlightElements(options, result.correct_indices);

            setStatus('done', `✅ Resposta: opções ${result.correct_indices.join(', ')}`);

            // Auto-click
            if (CFG.autoMode) {
                setTimeout(() => {
                    clickCorrect(options, result.correct_indices);
                    setStatus('done', `✅ Selecionado automaticamente • opções ${result.correct_indices.join(', ')}`);
                }, CFG.delay);
            }

        } catch (err) {
            setStatus('error', '❌ ' + (typeof err === 'string' ? err : err.message));
        } finally {
            isProcessing = false;
        }
    }

    // ─────────────────────────────────────────────
    //  MUTATION OBSERVER — watches for quiz changes
    // ─────────────────────────────────────────────
    let scanTimer = null;
    function scheduleScan(force = false) {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => scanAndAnswer(force), 800);
    }

    function observeDoc(doc) {
        try {
            const obs = new MutationObserver(() => scheduleScan());
            obs.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-question'] });
        } catch(e) {}
    }

    // Also observe iframes as they load
    function observeIframes() {
        document.querySelectorAll('iframe').forEach(f => {
            f.addEventListener('load', () => {
                try {
                    if (f.contentDocument) {
                        observeDoc(f.contentDocument);
                        scheduleScan();
                    }
                } catch(e) {}
            });
        });
    }

    // ─────────────────────────────────────────────
    //  INIT
    // ─────────────────────────────────────────────
    function init() {
        if (window.top !== window.self) {
            try {
                if (window.parent.document.getElementById('naq-panel')) return;
            } catch(e) {}
        }
        // ── DUPLICATE GUARD: only one panel per page ──
        if (document.getElementById('naq-panel')) return;

        buildPanel();
        setStatus('scanning', 'Monitorando página...');
        observeDoc(document);
        observeIframes();
        // Also re-check on URL changes (SPA navigation)
        window.addEventListener('locationchange', () => scheduleScan(true));
        window.addEventListener('popstate',        () => scheduleScan(true));
        // Initial scan
        scheduleScan();
        // Periodic scan as fallback every 5s
        setInterval(() => scanAndAnswer(), 5000);
    }

    // Wait for body
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
