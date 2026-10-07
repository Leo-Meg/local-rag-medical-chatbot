/**
 * config.example.js — template for the chatbot runtime configuration.
 *
 * Copy this file to `config.js` and fill in your own values.
 * `config.js` is git-ignored: never commit a real API key.
 */

const CONFIG = {
    /* Base URL of the AnythingLLM instance */
    ANYTHINGLLM_BASE : 'http://localhost:3001',

    /* Slug of the AnythingLLM workspace holding the RAG documents */
    WORKSPACE_SLUG   : 'WORKSPACE_SLUG',

    /* API key generated in AnythingLLM → Settings → API Keys */
    API_KEY          : 'API_KEY',

    /* Phone number shown in the widget's fallback messages */
    CONTACT_PHONE    : '01 23 45 67 89'
};
