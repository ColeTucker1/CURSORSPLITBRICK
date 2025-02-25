// Sample games data structure
let games = [];

// Constants for timing
const UPDATE_INTERVAL = 60000; // Update every 1 minute
const INITIAL_LOAD_DELAY = 100; // Faster initial load
const CACHE_DURATION = 30000; // 30 second cache

// Cache for API responses
const apiCache = new Map();

// Function to get universe ID from place ID
async function getUniverseId(placeId) {
    try {
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`)}`);
        const data = await response.json();
        const universeData = JSON.parse(data.contents);
        return universeData.universeId;
    } catch (error) {
        console.error('Error fetching universe ID:', error);
        return null;
    }
}

// Helper function to get cached or fresh data
async function fetchWithCache(url, cacheKey) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    const response = await fetch(url);
    const data = await response.json();
    
    apiCache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });
    
    return data;
}

// Function to add a new game
async function addGame(placeId) {
    try {
        // Get universe ID with caching
        const universeData = await fetchWithCache(
            `https://api.allorigins.win/get?url=${encodeURIComponent(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`)}`,
            `universe_${placeId}`
        );
        const universeId = JSON.parse(universeData.contents).universeId;
        
        // Get game data and icon in parallel
        const [gameData, iconData] = await Promise.all([
            fetchWithCache(
                `https://api.allorigins.win/get?url=${encodeURIComponent(`https://games.roblox.com/v1/games?universeIds=${universeId}`)}`,
                `game_${universeId}`
            ),
            fetchWithCache(
                `https://api.allorigins.win/get?url=${encodeURIComponent(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`)}`,
                `icon_${universeId}`
            )
        ]);
        
        if (gameData.contents) {
            const parsedGameData = JSON.parse(gameData.contents).data[0];
            const iconInfo = JSON.parse(iconData.contents).data[0];
            
            const newGame = {
                id: placeId,
                universeId, // Store for updates
                name: parsedGameData.name,
                thumbnail: iconInfo?.imageUrl || 'default-thumbnail.png',
                visits: parsedGameData.visits,
                playing: parsedGameData.playing
            };
            
            games.push(newGame);
            updateGamesList();
            updateTotalStats();
        }
    } catch (error) {
        console.error('Error adding game:', error);
    }
}

// Add this new function to format numbers
function formatNumber(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1).replace('.0', '') + 'B';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    }
    return num.toString();
}

// Function to update the games list
function updateGamesList() {
    const container = document.getElementById('games-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sort games by current players (playing) in descending order
    games.sort((a, b) => b.playing - a.playing);
    
    // Show all games if we're on the games page, otherwise show top 4
    const isGamesPage = window.location.pathname.includes('games.html');
    const gamesToShow = isGamesPage ? games : games.slice(0, 4);
    
    gamesToShow.forEach(game => {
        const gameStats = isGamesPage ? `
            <div class="stat-row">
                <span class="stat-value"><strong>${formatNumber(game.playing)} active players</strong></span>
            </div>
            <div class="stat-row">
                <span class="stat-value">${formatNumber(game.visits)} visits</span>
            </div>
        ` : `
            <div class="stat-row">
                <span class="stat-value"><strong>${formatNumber(game.playing)} active players</strong></span>
            </div>
        `;

        const gameCard = `
            <div class="game-card">
                <a href="https://www.roblox.com/games/${game.id}" target="_blank">
                    <div class="game-thumbnail">
                        <img src="${game.thumbnail}" alt="${game.name}" loading="lazy">
                    </div>
                    <div class="game-info">
                        <h3 class="game-title">${game.name}</h3>
                        <div class="game-stats">
                            ${gameStats}
                        </div>
                    </div>
                </a>
            </div>
        `;
        container.innerHTML += gameCard;
    });
}

// Add these helper functions at the top of the file
function tween(start, end, duration, onUpdate) {
    const startTime = performance.now();
    const diff = end - start;
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeProgress = progress < .5 ? 
            4 * progress * progress * progress : 
            1 - Math.pow(-2 * progress + 2, 3) / 2;
            
        const current = Math.round(start + (diff * easeProgress));
        onUpdate(current);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Add smooth scroll reveal
function revealOnScroll() {
    const elements = document.querySelectorAll('.game-card');
    elements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 150;
        
        if (elementTop < window.innerHeight - elementVisible) {
            element.classList.add('visible');
        }
    });
}

// Smooth stat number updates
function updateDisplayWithTween(elementId, newValue) {
    const element = document.getElementById(elementId);
    const currentValue = parseInt(element.textContent.replace(/[^0-9]/g, ''), 10);
    
    element.style.transform = 'scale(1.1)';
    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 200);
    
    tween(currentValue, newValue, 1000, (value) => {
        element.textContent = formatNumber(value);
    });
}

// Function to update total stats
function updateTotalStats() {
    const totalPlaying = games.reduce((sum, game) => sum + game.playing, 0);
    const totalVisits = games.reduce((sum, game) => sum + game.visits, 0);
    
    // Only update stats if the elements exist (home page)
    const playersElement = document.getElementById('total-players');
    const visitsElement = document.getElementById('total-visits');
    
    if (playersElement) {
        updateDisplayWithTween('total-players', totalPlaying);
    }
    if (visitsElement) {
        updateDisplayWithTween('total-visits', totalVisits);
    }
}

// Show loading state while games load
function showLoadingState() {
    const container = document.getElementById('games-container');
    if (!container) return;
    
    const numCards = window.location.pathname.includes('games.html') ? games.length || 4 : 4;
    const skeletonCards = Array(numCards).fill(`
        <div class="game-card skeleton">
            <div class="game-thumbnail shimmer"></div>
            <div class="game-info">
                <div class="title-skeleton shimmer"></div>
                <div class="stats-skeleton shimmer"></div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = skeletonCards;
}

// Initialize games quickly
async function initializeGames() {
    showLoadingState();
    
    const gameIds = [
        '14567590300',  // BATHE DA BABY
        '5656646615',   // Dream Island RP
        '5254674128',   // Pet Store Tycoon
        '13278651209',  // Pet Store Tycoon 2
        '18799085098',  // Hide or Die
        '107397057618236', // Oldies
        '123301586342148'  // Dangerous School Bus Driving
    ];

    // Load all games in parallel for faster initial load
    await Promise.all(gameIds.map(id => addGame(id)));
    
    // Start updates
    setInterval(updateGameStats, UPDATE_INTERVAL);
}

// Update game stats efficiently
async function updateGameStats() {
    try {
        // Update all games in parallel
        await Promise.all(games.map(async (game) => {
            try {
                const gameData = await fetchWithCache(
                    `https://api.allorigins.win/get?url=${encodeURIComponent(`https://games.roblox.com/v1/games?universeIds=${game.universeId}`)}`,
                    `game_${game.universeId}`
                );
                
                if (gameData.contents) {
                    const parsedData = JSON.parse(gameData.contents).data[0];
                    game.playing = parsedData.playing;
                    game.visits = parsedData.visits;
                }
            } catch (error) {
                console.error('Error updating game:', error);
            }
        }));
        
        updateGamesList();
        updateTotalStats();
    } catch (error) {
        console.error('Error in update cycle:', error);
    }
}

// Start everything when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeGames();
    revealOnScroll();
});

// Remove the incorrect IDs
// addGame('107397057618236');  // Oldies - ID seems incorrect
// addGame('123301586342148');  // Dangerous School Bus Driving - ID seems incorrect

// Remove the sample game
// addGame('12345678'); 

// Initialize
window.addEventListener('scroll', revealOnScroll);
document.addEventListener('DOMContentLoaded', revealOnScroll);

// Add carousel navigation
document.addEventListener('DOMContentLoaded', () => {
    const carousel = document.querySelector('.carousel');
    const prevBtn = document.querySelector('.carousel-btn.prev');
    const nextBtn = document.querySelector('.carousel-btn.next');
    
    if (!carousel || !prevBtn || !nextBtn) return;

    prevBtn.addEventListener('click', () => {
        carousel.scrollBy({
            left: -350,
            behavior: 'smooth'
        });
    });

    nextBtn.addEventListener('click', () => {
        carousel.scrollBy({
            left: 350,
            behavior: 'smooth'
        });
    });
});

// Add this to your existing script.js
function initCaptcha() {
    // Generate random operation (1: addition, 2: subtraction, 3: multiplication)
    const operation = Math.floor(Math.random() * 3) + 1;
    let num1, num2, expectedResult, operationSymbol;
    
    switch(operation) {
        case 1: // Addition
            num1 = Math.floor(Math.random() * 20) + 1;
            num2 = Math.floor(Math.random() * 20) + 1;
            expectedResult = num1 + num2;
            operationSymbol = '+';
            break;
        case 2: // Subtraction
            num1 = Math.floor(Math.random() * 30) + 20; // Ensure first number is larger
            num2 = Math.floor(Math.random() * num1);
            expectedResult = num1 - num2;
            operationSymbol = '-';
            break;
        case 3: // Multiplication
            num1 = Math.floor(Math.random() * 10) + 1;
            num2 = Math.floor(Math.random() * 5) + 1;
            expectedResult = num1 * num2;
            operationSymbol = '×';
            break;
    }
    
    // Update the display
    document.getElementById('num1').textContent = num1;
    document.getElementById('operation').textContent = operationSymbol;
    document.getElementById('num2').textContent = num2;
    
    return expectedResult;
}

document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    let expectedSum = initCaptcha();
    
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const result = parseInt(document.getElementById('result').value);
            if (result !== expectedSum) {
                alert('Please solve the math problem correctly to verify you are human.');
                expectedSum = initCaptcha(); // Reset captcha
                document.getElementById('result').value = '';
                return;
            }
            
            const formData = new FormData(contactForm);
            try {
                // Here you would typically send the data to your server
                console.log('Form submitted:', Object.fromEntries(formData));
                alert('Thank you for your message! We will get back to you soon.');
                contactForm.reset();
                expectedSum = initCaptcha(); // Reset captcha
            } catch (error) {
                console.error('Error submitting form:', error);
                alert('There was an error sending your message. Please try again.');
            }
        });
    }
});

// Add smooth scroll handler
document.addEventListener('DOMContentLoaded', () => {
    const talkButton = document.querySelector('a[href="#contact-form"]');
    
    if (talkButton) {
        talkButton.addEventListener('click', (e) => {
            e.preventDefault();
            
            const contactForm = document.getElementById('contact-form');
            if (contactForm) {
                contactForm.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'center'
                });
                
                // Optional: Focus on first input after scrolling
                setTimeout(() => {
                    contactForm.querySelector('input').focus();
                }, 800);
            }
        });
    }
});

// Handle page transitions and content reveal
document.addEventListener('DOMContentLoaded', () => {
    // Add active class to current page nav link
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    const heroContent = document.querySelector('.hero-content');
    
    // Add visible class after a short delay
    setTimeout(() => {
        if (heroContent) {
            heroContent.classList.add('visible');
        }
    }, 100);

    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }

        link.addEventListener('click', (e) => {
            if (link.href !== window.location.href) {
                e.preventDefault();
                document.body.classList.add('page-transition');
                
                setTimeout(() => {
                    window.location = link.href;
                }, 300);
            }
        });
    });
});

// Remove transition class when page loads
window.onload = () => {
    document.body.classList.remove('page-transition');
};

// Add cosmic hover effect to game cards
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.game-card');
    
    cards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
            card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        });
    });
}); 