// Translate page functionality
class TranslatePage {
    constructor() {
        this.token = localStorage.getItem('access_token');
        this.isInitializing = false;
        this.init();
    }

    init() {
        // Prevent multiple initializations
        if (this.isInitializing) {
            console.log('Translate page already initializing, skipping...');
            return;
        }
        
        this.isInitializing = true;
        console.log('Initializing translate page...');
        
        // Check authentication
        if (!this.token) {
            console.log('No token found, redirecting to login');
            window.location.href = '/';
            return;
        }

        // Bind event listeners
        this.bindEvents();
        
        // Set default target language to Tamil if source is English
        document.getElementById('targetLanguage').value = 'ta';
        
        console.log('Translate page initialized successfully');
        this.isInitializing = false;
    }

    bindEvents() {
        // Form submission
        document.getElementById('translateForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTranslation();
        });

        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearForm();
        });

        // Language swap button
        document.getElementById('swapLanguages').addEventListener('click', () => {
            this.swapLanguages();
        });

        // Character counter
        document.getElementById('inputText').addEventListener('input', (e) => {
            this.updateCharCounter(e.target.value.length);
        });

        // Play audio button
        document.getElementById('playAudioBtn').addEventListener('click', () => {
            this.playAudio();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Auto-resize textarea
        document.getElementById('inputText').addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }

    async handleTranslation() {
        const sourceLanguage = document.getElementById('sourceLanguage').value;
        const targetLanguage = document.getElementById('targetLanguage').value;
        const inputText = document.getElementById('inputText').value.trim();

        if (!inputText) {
            this.showError('Please enter text to translate');
            return;
        }

        if (sourceLanguage === targetLanguage && sourceLanguage !== 'auto') {
            this.showError('Source and target languages cannot be the same');
            return;
        }

        try {
            this.showLoading(true);
            this.hideError();
            this.hideResult();

            const response = await fetch('/translate-and-speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    text: inputText,
                    target_languages: [targetLanguage],
                    source_language: sourceLanguage
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                this.displayResult(inputText, result, sourceLanguage, targetLanguage);
            } else {
                throw new Error('No translation results received');
            }

        } catch (error) {
            console.error('Translation error:', error);
            this.showError('Failed to translate text. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    displayResult(originalText, result, sourceLanguage, targetLanguage) {
        // Display original text
        document.getElementById('originalText').textContent = originalText;
        document.getElementById('originalLanguage').textContent = 
            `Language: ${this.getLanguageName(sourceLanguage)}`;

        // Display translated text
        document.getElementById('translatedText').textContent = result.translated_text;
        document.getElementById('translatedLanguage').textContent = 
            `Language: ${this.getLanguageName(targetLanguage)}`;

        // Setup audio if available
        if (result.audio_url) {
            const audioPlayer = document.getElementById('audioPlayer');
            const playButton = document.getElementById('playAudioBtn');
            
            audioPlayer.src = result.audio_url;
            playButton.style.display = 'inline-block';
            audioPlayer.style.display = 'block';
        } else {
            document.getElementById('playAudioBtn').style.display = 'none';
            document.getElementById('audioPlayer').style.display = 'none';
        }

        // Show result section
        document.getElementById('resultSection').style.display = 'block';
        
        // Scroll to result
        document.getElementById('resultSection').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }

    getLanguageName(code) {
        const languages = {
            'auto': 'Auto-detect',
            'en': 'English',
            'ta': 'Tamil',
            'hi': 'Hindi',
            'te': 'Telugu',
            'ar': 'Arabic',
            'zh-cn': 'Chinese (Simplified)',
            'zh-tw': 'Chinese (Traditional)',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'tr': 'Turkish',
            'vi': 'Vietnamese',
            'th': 'Thai',
            'id': 'Indonesian',
            'ms': 'Malay',
            'fil': 'Filipino'
        };
        return languages[code] || code;
    }

    swapLanguages() {
        const sourceSelect = document.getElementById('sourceLanguage');
        const targetSelect = document.getElementById('targetLanguage');
        
        // Don't swap if source is auto-detect
        if (sourceSelect.value === 'auto') {
            this.showError('Cannot swap when source language is auto-detect');
            return;
        }

        const sourceValue = sourceSelect.value;
        const targetValue = targetSelect.value;
        
        sourceSelect.value = targetValue;
        targetSelect.value = sourceValue;
    }

    clearForm() {
        document.getElementById('inputText').value = '';
        document.getElementById('sourceLanguage').value = 'auto';
        document.getElementById('targetLanguage').value = 'ta';
        this.updateCharCounter(0);
        this.hideResult();
        this.hideError();
        
        // Reset textarea height
        document.getElementById('inputText').style.height = 'auto';
    }

    updateCharCounter(count) {
        const counter = document.getElementById('charCount');
        counter.textContent = count;
        
        if (count > 5000) {
            counter.style.color = '#e74c3c';
        } else if (count > 4500) {
            counter.style.color = '#f39c12';
        } else {
            counter.style.color = '#666';
        }
    }

    playAudio() {
        const audio = document.getElementById('audioPlayer');
        if (audio.src) {
            audio.play().catch(error => {
                console.error('Error playing audio:', error);
                this.showError('Failed to play audio');
            });
        }
    }

    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        const button = document.getElementById('translateBtn');
        
        if (show) {
            spinner.style.display = 'block';
            button.disabled = true;
            button.innerHTML = '⏳ Translating...';
        } else {
            spinner.style.display = 'none';
            button.disabled = false;
            button.innerHTML = '🌐 Translate & Speak';
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }

    hideResult() {
        document.getElementById('resultSection').style.display = 'none';
    }

    logout() {
        console.log('Logging out from translate page');
        localStorage.removeItem('access_token');
        localStorage.removeItem('selectedLanguage');
        window.location.href = '/';
    }
}

// Initialize the translate page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TranslatePage();
});
