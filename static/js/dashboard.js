// Dashboard JavaScript

// Global variables
let supportedLanguages = {};
let currentUser = null;
let selectedLanguage = null;
let isInitializing = false;

// DOM Elements
const welcomeMessage = document.getElementById('welcomeMessage');
const logoutBtn = document.getElementById('logoutBtn');
const targetLanguagesSelect = document.getElementById('targetLanguages');
const audioSection = document.getElementById('audioSection');
const audioPlayer = document.getElementById('audioPlayer');
const audioLanguage = document.getElementById('audioLanguage');
const audioText = document.getElementById('audioText');
const downloadBtn = document.getElementById('downloadBtn');
const newAudioBtn = document.getElementById('newAudioBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const messageContainer = document.getElementById('messageContainer');

// Event Listeners
document.addEventListener('DOMContentLoaded', initDashboard);
logoutBtn.addEventListener('click', handleLogout);
newAudioBtn.addEventListener('click', showNewAudioForm);

// Add event listeners for announcement buttons
document.addEventListener('click', function(e) {
    if (e.target.matches('.announcement-btn')) {
        const announcementText = e.target.getAttribute('data-text');
        const announcementCard = e.target.closest('.announcement-card');
        handleTrainAnnouncement(announcementText, announcementCard);
    }
});

// Add event listener for language selection
document.addEventListener('change', function(e) {
    if (e.target.id === 'targetLanguages') {
        const selectedValue = e.target.value;
        if (selectedValue) {
            selectedLanguage = selectedValue;
            localStorage.setItem('selectedLanguage', selectedValue);
            showMessage(`Language set to ${getLanguageName(selectedValue)}`, 'success');
        }
    }
});

// Authentication helper
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        return null; // Don't redirect here, let the caller handle it
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// Initialization
async function initDashboard() {
    // Prevent multiple initializations
    if (isInitializing) {
        console.log('Dashboard already initializing, skipping...');
        return;
    }
    
    isInitializing = true;
    console.log('Initializing dashboard...');
    
    // Check authentication
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = '/';
        return;
    }

    try {
        // Get current user info
        await getCurrentUser();
        // Load supported languages
        await loadSupportedLanguages();
        // Load saved language preference
        loadSavedLanguage();
        console.log('Dashboard initialized successfully');
    } catch (error) {
        console.error('Dashboard initialization failed:', error);
        showMessage('Failed to initialize dashboard. Please try refreshing the page.', 'error');
    } finally {
        isInitializing = false;
    }
}

function loadSavedLanguage() {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage && targetLanguagesSelect) {
        // Check if the saved language still exists in the options
        const option = targetLanguagesSelect.querySelector(`option[value="${savedLanguage}"]`);
        if (option) {
            targetLanguagesSelect.value = savedLanguage;
            selectedLanguage = savedLanguage;
            showMessage(`Welcome back! Language set to ${getLanguageName(savedLanguage)}`, 'info');
        } else {
            // Remove invalid saved language
            localStorage.removeItem('selectedLanguage');
        }
    }
}

async function getCurrentUser() {
    const headers = getAuthHeaders();
    if (!headers) {
        console.log('No auth headers, redirecting to login');
        window.location.href = '/';
        return;
    }

    try {
        const response = await fetch('/me', { headers });
        
        if (response.ok) {
            currentUser = await response.json();
            welcomeMessage.textContent = `Welcome, ${currentUser.username}!`;
            console.log('User authenticated successfully:', currentUser.username);
        } else if (response.status === 401) {
            console.log('Token expired or invalid, redirecting to login');
            localStorage.removeItem('access_token');
            localStorage.removeItem('selectedLanguage');
            window.location.href = '/';
        } else {
            throw new Error(`HTTP ${response.status}: Failed to get user info`);
        }
    } catch (error) {
        console.error('Get user error:', error);
        // Only redirect on auth errors, not network errors
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('selectedLanguage');
            window.location.href = '/';
        } else {
            showMessage('Network error. Please check your connection and refresh.', 'error');
        }
    }
}

async function loadSupportedLanguages() {
    try {
        const response = await fetch('/supported-languages');
        const data = await response.json();
        supportedLanguages = data.languages;
        
        populateLanguageSelects();
    } catch (error) {
        console.error('Failed to load languages:', error);
        showMessage('Failed to load supported languages', 'error');
    }
}

function populateLanguageSelects() {
    // Clear existing options
    targetLanguagesSelect.innerHTML = '<option value="">Select announcement language...</option>';

    // Populate target languages select
    Object.entries(supportedLanguages).forEach(([code, name]) => {
        const targetOption = document.createElement('option');
        targetOption.value = code;
        targetOption.textContent = `${name} (${code})`;
        targetLanguagesSelect.appendChild(targetOption);
    });
}

// Utility functions
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    messageContainer.innerHTML = '';
    messageContainer.appendChild(messageDiv);
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
    
    // Scroll to message
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearMessages() {
    messageContainer.innerHTML = '';
}

function showLoading(show = true) {
    loadingIndicator.style.display = show ? 'block' : 'none';
}

function getLanguageName(code) {
    return supportedLanguages[code] || code;
}

// Event handlers
function handleLogout() {
    console.log('Logging out from dashboard');
    localStorage.removeItem('access_token');
    localStorage.removeItem('selectedLanguage');
    showMessage('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = '/';
    }, 1000);
}

async function handleTrainAnnouncement(announcementText, announcementCard) {
    if (!selectedLanguage) {
        showMessage('Please select a language first', 'error');
        return;
    }
    
    // Clear previous active states
    document.querySelectorAll('.announcement-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // Mark current card as active
    announcementCard.classList.add('active');
    
    clearMessages();
    
    const headers = getAuthHeaders();
    if (!headers) return;
    
    try {
        // Show loading
        showLoading(true);
        
        const response = await fetch('/generate-audio', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                text: announcementText,
                language: selectedLanguage
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            showAudioSection(data, announcementText);
            showMessage('Announcement generated successfully!', 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Failed to generate announcement');
        }
    } catch (error) {
        console.error('Announcement generation error:', error);
        showMessage(`Error: ${error.message}`, 'error');
        announcementCard.classList.remove('active');
    } finally {
        showLoading(false);
    }
}

function showAudioSection(audioData, text) {
    audioLanguage.textContent = getLanguageName(selectedLanguage);
    audioText.textContent = text;
    audioPlayer.src = audioData.audio_url;
    audioSection.style.display = 'block';
    
    // Scroll to audio section
    audioSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Set up download functionality
    downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.href = audioData.audio_url;
        link.download = `train_announcement_${Date.now()}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
}

function showNewAudioForm() {
    audioSection.style.display = 'none';
    document.querySelectorAll('.announcement-card').forEach(card => {
        card.classList.remove('active');
    });
    showMessage('Select another train announcement', 'info');
}

// Utility functions
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    messageContainer.innerHTML = '';
    messageContainer.appendChild(messageDiv);
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
    
    // Scroll to message
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearMessages() {
    messageContainer.innerHTML = '';
}

function showLoading(show = true) {
    loadingIndicator.style.display = show ? 'block' : 'none';
}

function getLanguageName(code) {
    return supportedLanguages[code] || code;
}

// Authentication helper
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/';
        return null;
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to hide audio section
    if (e.key === 'Escape') {
        audioSection.style.display = 'none';
        document.querySelectorAll('.announcement-card').forEach(card => {
            card.classList.remove('active');
        });
        clearMessages();
    }
    
    // Numbers 1-5 to trigger announcements
    if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const announcementNumber = parseInt(e.key);
        const announcementCard = document.querySelector(`[data-announcement="${announcementNumber}"]`);
        if (announcementCard) {
            const announcementBtn = announcementCard.querySelector('.announcement-btn');
            if (announcementBtn) {
                announcementBtn.click();
            }
        }
    }
});
