// Authentication JavaScript

// DOM Elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignupLink = document.getElementById('showSignup');
const showLoginLink = document.getElementById('showLogin');
const loginFormElement = document.getElementById('loginFormElement');
const signupFormElement = document.getElementById('signupFormElement');
const messageContainer = document.getElementById('messageContainer');

// Event Listeners
showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    showSignup();
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLogin();
});

loginFormElement.addEventListener('submit', handleLogin);
signupFormElement.addEventListener('submit', handleSignup);

// Functions
function showSignup() {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    clearMessages();
}

function showLogin() {
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
    clearMessages();
}

function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    messageContainer.innerHTML = '';
    messageContainer.appendChild(messageDiv);
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
}

function clearMessages() {
    messageContainer.innerHTML = '';
}

function validateForm(formData, isSignup = false) {
    const username = formData.get('username');
    const password = formData.get('password');
    
    if (!username || username.length < 3) {
        showMessage('Username must be at least 3 characters long', 'error');
        return false;
    }
    
    if (!password || password.length < 6) {
        showMessage('Password must be at least 6 characters long', 'error');
        return false;
    }
    
    if (isSignup) {
        const confirmPassword = formData.get('confirmPassword');
        if (password !== confirmPassword) {
            showMessage('Passwords do not match', 'error');
            return false;
        }
    }
    
    return true;
}

async function handleLogin(e) {
    e.preventDefault();
    clearMessages();
    
    const formData = new FormData(e.target);
    
    if (!validateForm(formData)) {
        return;
    }
    
    const loginData = {
        username: formData.get('username'),
        password: formData.get('password')
    };
    
    try {
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Logging in...';
        
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(loginData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Store the token
            localStorage.setItem('access_token', result.access_token);
            
            showMessage('Login successful! Redirecting...', 'success');
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1000);
        } else {
            showMessage(result.detail || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Network error. Please try again.', 'error');
    } finally {
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.textContent = 'Login';
    }
}

async function handleSignup(e) {
    e.preventDefault();
    clearMessages();
    
    const formData = new FormData(e.target);
    
    if (!validateForm(formData, true)) {
        return;
    }
    
    const signupData = {
        username: formData.get('username'),
        password: formData.get('password')
    };
    
    try {
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Creating Account...';
        
        const response = await fetch('/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(signupData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Account created successfully! Please login.', 'success');
            
            // Switch to login form after successful signup
            setTimeout(() => {
                showLogin();
                // Pre-fill username in login form
                document.getElementById('loginUsername').value = signupData.username;
            }, 1500);
        } else {
            showMessage(result.detail || 'Signup failed', 'error');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showMessage('Network error. Please try again.', 'error');
    } finally {
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.textContent = 'Sign Up';
    }
}

// Check if user is already logged in
function checkAuthStatus() {
    // Don't run auth check if we're already on a protected page
    if (window.location.pathname === '/dashboard' || window.location.pathname === '/translate') {
        return;
    }
    
    const token = localStorage.getItem('access_token');
    if (token) {
        // Verify token is still valid
        fetch('/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                // Token is valid, redirect to dashboard
                console.log('Token valid, redirecting to dashboard');
                window.location.href = '/dashboard';
            } else {
                // Token is invalid, remove it
                console.log('Token invalid, removing');
                localStorage.removeItem('access_token');
                localStorage.removeItem('selectedLanguage');
            }
        })
        .catch(error => {
            console.error('Auth check error:', error);
            localStorage.removeItem('access_token');
            localStorage.removeItem('selectedLanguage');
        });
    }
}

// Check auth status on page load only for login page
document.addEventListener('DOMContentLoaded', () => {
    // Only run auth check on the login page
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        checkAuthStatus();
    }
});
