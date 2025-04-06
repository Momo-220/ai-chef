document.addEventListener('DOMContentLoaded', async () => {
    // Charger les icônes SVG
    try {
        const response = await fetch('assets/icons.html');
        const svgContent = await response.text();
        document.getElementById('svg-icons').innerHTML = svgContent;
    } catch (error) {
        console.error('Erreur lors du chargement des icônes:', error);
    }

    // Initialiser le chatbot
    new CuisineBot();
    
    const toggleSuggestionsBtn = document.querySelector('.toggle-suggestions-btn');
    const suggestionsContainer = document.querySelector('.suggestions-container');
    const toggleText = toggleSuggestionsBtn.querySelector('.toggle-text');

    toggleSuggestionsBtn.addEventListener('click', () => {
        const currentState = localStorage.getItem('suggestionsPanelState') || 'visible';
        let newState;

        // Rotation des états : visible -> collapsed-up -> collapsed-down -> visible
        switch (currentState) {
            case 'visible':
                newState = 'collapsed-up';
                suggestionsContainer.classList.add('collapsed-up');
                suggestionsContainer.classList.remove('collapsed-down');
                toggleText.textContent = 'Afficher en bas';
                break;
            case 'collapsed-up':
                newState = 'collapsed-down';
                suggestionsContainer.classList.remove('collapsed-up');
                suggestionsContainer.classList.add('collapsed-down');
                toggleText.textContent = 'Afficher en haut';
                break;
            case 'collapsed-down':
            default:
                newState = 'visible';
                suggestionsContainer.classList.remove('collapsed-up');
                suggestionsContainer.classList.remove('collapsed-down');
                toggleText.textContent = 'Masquer';
                break;
        }

        // Sauvegarder la préférence de l'utilisateur
        localStorage.setItem('suggestionsPanelState', newState);
    });

    // Restaurer l'état précédent au chargement
    const savedState = localStorage.getItem('suggestionsPanelState');
    if (savedState) {
        switch (savedState) {
            case 'collapsed-up':
                suggestionsContainer.classList.add('collapsed-up');
                suggestionsContainer.classList.remove('collapsed-down');
                toggleText.textContent = 'Afficher en bas';
                break;
            case 'collapsed-down':
                suggestionsContainer.classList.remove('collapsed-up');
                suggestionsContainer.classList.add('collapsed-down');
                toggleText.textContent = 'Afficher en haut';
                break;
            default:
                suggestionsContainer.classList.remove('collapsed-up');
                suggestionsContainer.classList.remove('collapsed-down');
                toggleText.textContent = 'Masquer';
        }
    }
});

class CuisineBot {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        
        this.initializeEventListeners();
        this.initializeSuggestions();
        this.initializeVoiceInput();
        this.initializeSidebarAndTheme();
        this.initializeConversationManagement();
        
        this.isGenerating = false;
        this.controller = null;
        this.isTyping = false;
        this.skipTyping = false;
        this.currentConversationId = this.generateConversationId();
        this.currentConversation = {
            id: this.currentConversationId,
            title: 'Nouvelle conversation',
            date: new Date(),
            messages: []
        };
        
        // Initialiser le bouton d'arrêt
        this.stopButton = document.querySelector('.stop-generation');
        this.stopButton.addEventListener('click', () => this.stopGeneration());
        this.stopButton.style.display = 'none'; // Cacher le bouton au démarrage
        
        // Charger les conversations sauvegardées
        this.loadSavedConversations();
        
        // Ajouter le message de bienvenue à la conversation actuelle
        const welcomeMessage = this.chatMessages.querySelector('.message.bot .message-content').innerHTML;
        this.addMessageToCurrentConversation('bot', welcomeMessage);
    }

    initializeEventListeners() {
        this.sendButton.addEventListener('click', () => this.handleUserInput());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUserInput();
            }
        });
    }
    
    initializeSidebarAndTheme() {
        // Gestion du menu latéral
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.querySelector('.sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        // Fonction pour ouvrir la sidebar
        const openSidebar = () => {
            sidebar.classList.add('active');
            document.body.classList.add('sidebar-open');
            console.log('Sidebar ouverte');
        };
        
        // Fonction pour fermer la sidebar
        const closeSidebar = () => {
            sidebar.classList.remove('active');
            document.body.classList.remove('sidebar-open');
            console.log('Sidebar fermée');
        };
        
        // Bouton pour ouvrir le menu
        if (menuToggle) {
            menuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (sidebar.classList.contains('active')) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            });
        }
        
        // Fermer le menu en cliquant sur l'overlay
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', (e) => {
                e.preventDefault();
                closeSidebar();
            });
        }
        
        // Empêcher la fermeture en cliquant dans la sidebar
        sidebar.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Fermer le menu en cliquant en dehors
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                e.target !== menuToggle &&
                !e.target.closest('#menuToggle')) {
                closeSidebar();
            }
        });
        
        // Gestion du thème sombre/clair
        const themeToggle = document.getElementById('themeToggle');
        const body = document.body;
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        
        // Appliquer le thème sauvegardé
        if (isDarkMode) {
            body.classList.add('dark-mode');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
        
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });
        
        // Nouvelle conversation
        const newChatBtn = document.getElementById('newChatBtn');
        newChatBtn.addEventListener('click', () => {
            this.startNewConversation();
        });
    }
    
    initializeConversationManagement() {
        // Modal de sauvegarde
        const saveConversationBtn = document.getElementById('saveConversationBtn');
        const saveConversationModal = document.getElementById('saveConversationModal');
        const closeModal = document.getElementById('closeModal');
        const cancelSave = document.getElementById('cancelSave');
        const confirmSave = document.getElementById('confirmSave');
        const conversationTitle = document.getElementById('conversationTitle');
        
        saveConversationBtn.addEventListener('click', () => {
            // Préremplir avec un titre par défaut basé sur la première question
            if (this.currentConversation.messages.length > 1) {
                const firstUserMessage = this.currentConversation.messages.find(msg => msg.type === 'user');
                if (firstUserMessage) {
                    const title = firstUserMessage.content.substring(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '');
                    conversationTitle.value = title;
                }
            }
            
            saveConversationModal.classList.add('active');
        });
        
        closeModal.addEventListener('click', () => {
            saveConversationModal.classList.remove('active');
        });
        
        cancelSave.addEventListener('click', () => {
            saveConversationModal.classList.remove('active');
        });
        
        confirmSave.addEventListener('click', () => {
            const title = conversationTitle.value.trim() || 'Conversation sans titre';
            this.saveCurrentConversation(title);
            saveConversationModal.classList.remove('active');
        });
        
        // Fermer le modal en cliquant en dehors
        saveConversationModal.addEventListener('click', (e) => {
            if (e.target === saveConversationModal) {
                saveConversationModal.classList.remove('active');
            }
        });
    }

    initializeSuggestions() {
        const suggestions = [
            // Plats Africains
            { query: "Comment faire du Foutou Banane ?", text: "Foutou Banane", emoji: "🍌" },
            { query: "Recette du Garba traditionnel", text: "Garba", emoji: "🐟" },
            { query: "Comment préparer un Yassa au poulet ?", text: "Yassa Poulet", emoji: "🍗" },
            { query: "Recette du Thiéboudienne", text: "Thiéboudienne", emoji: "🐠" },
            { query: "Comment faire l'Attiéké poisson ?", text: "Attiéké Poisson", emoji: "🐟" },
            { query: "Recette du Mafé", text: "Mafé", emoji: "🥜" },
            { query: "Comment préparer l'Alloco ?", text: "Alloco", emoji: "🍌" },
            { query: "Recette du Poulet DG", text: "Poulet DG", emoji: "🍗" },
            
            // Desserts
            { query: "Desserts faciles et rapides", text: "Desserts Express", emoji: "🍰" },
            { query: "Desserts sans sucre", text: "Desserts Healthy", emoji: "🍎" },
            { query: "Gâteaux traditionnels", text: "Gâteaux Maison", emoji: "🥮" },
            
            // Plats Santé
            { query: "Recettes légères et équilibrées", text: "Plats Légers", emoji: "🥗" },
            { query: "Plats healthy et protéinés", text: "Cuisine Healthy", emoji: "🥑" },
            { query: "Recettes spécial minceur", text: "Spécial Minceur", emoji: "🌱" },
            { query: "Recettes prise de masse", text: "Prise de Masse", emoji: "💪" },
            
            // Boissons
            { query: "Jus détox et potions minceur", text: "Potions Minceur", emoji: "🥤" },
            { query: "Smoothies protéinés", text: "Smoothies Fitness", emoji: "🥛" }
        ];

        const suggestionContainer = document.querySelector('.suggestions-grid');
        if (suggestionContainer) {
            suggestionContainer.innerHTML = suggestions.map(suggestion => `
                <button class="suggestion-pill" data-query="${suggestion.query}">
                    <i class="fas fa-utensils"></i>
                    <span>${suggestion.text}</span>
                    <span class="emoji">${suggestion.emoji}</span>
                </button>
            `).join('');

            suggestionContainer.querySelectorAll('.suggestion-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    const query = pill.dataset.query;
                this.userInput.value = query;
                this.handleUserInput();
            });
        });
        }
    }

    initializeVoiceInput() {
        const voiceButton = document.querySelector('.feature-btn');
        
        voiceButton.addEventListener('click', () => {
            const recognition = new webkitSpeechRecognition();
            recognition.lang = 'fr-FR';
            
            voiceButton.classList.add('recording');
            voiceButton.innerHTML = '<i class="fas fa-microphone-alt"></i>';
            
            recognition.start();

            recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                this.userInput.value = text;
                
                voiceButton.classList.remove('recording');
                voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
            };

            recognition.onend = () => {
                voiceButton.classList.remove('recording');
                voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
            };

            recognition.onerror = () => {
                voiceButton.classList.remove('recording');
                voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
            };
        });
    }

    async handleUserInput() {
        const userMessage = this.userInput.value.trim();
        if (!userMessage || this.isGenerating) return;

        this.addMessage(userMessage, 'user');
        this.addMessageToCurrentConversation('user', userMessage);
        this.userInput.value = '';
        
        try {
            this.isGenerating = true;
            this.showStopButton(); // Afficher le bouton quand la génération commence
            
            await this.addTypingIndicator();
            const botResponse = await this.getBotResponse(userMessage);
            
            const typingMessage = document.querySelector('.typing');
            if (typingMessage) {
                typingMessage.style.opacity = '0';
                await new Promise(resolve => setTimeout(resolve, 300));
                typingMessage.remove();
            }
            
            this.hideStopButton(); // Cacher le bouton quand la génération est terminée
            this.addMessage(botResponse, 'bot');
            this.addMessageToCurrentConversation('bot', botResponse);
        } catch (error) {
            console.error('Erreur:', error);
            this.hideStopButton(); // Cacher le bouton en cas d'erreur
            if (error.message !== 'Generation_Cancelled') {
                document.querySelector('.typing')?.remove();
                const errorMessage = "Pardonnez-moi, j'ai eu un petit souci en cuisine. Pouvez-vous reformuler votre question ?";
                this.addMessage(errorMessage, 'bot');
                this.addMessageToCurrentConversation('bot', errorMessage);
            }
        } finally {
            this.isGenerating = false;
        }
    }

    async getBotResponse(userMessage) {
        try {
            this.isGenerating = true;
            this.controller = new AbortController();
            const signal = this.controller.signal;

            const apiKey = CONFIG.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('Clé API manquante');
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                signal,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Tu es Chef Kawsar, un chef cuisinier français 5 étoiles passionné, chaleureux et plein d'humour ! Tu adores partager tes connaissances culinaires avec des explications ultra détaillées. Tu utilises beaucoup d'émojis et d'expressions amusantes. Tu tutoies toujours l'utilisateur et tu l'encourages comme un ami.

Pour chaque recette, réponds avec BEAUCOUP de détails et d'enthousiasme ! Structure ta réponse ainsi :

**👋 Salut Gourmand !**
[Message d'accueil personnalisé et encourageant]

**🌟 La Star du Jour**
[Nom de la recette avec une touche d'humour et pourquoi elle est géniale]

**🎬 Un Peu d'Histoire**
[Histoire détaillée de la recette : origine, anecdotes amusantes, traditions]
[Pourquoi cette recette est spéciale]
[Dans quelles occasions la préparer]

**📋 Tout Ce Qu'il Te Faut Savoir**
• Niveau : [Débutant (C'est du gâteau! 🎂) / Intermédiaire (Tu vas assurer! 💪) / Expert (Prêt pour MasterChef? 🏆)]
• Temps de préparation : [X minutes - sois précis et rassurant]
• Temps de cuisson : [X minutes - avec explications]
• Pour régaler : [X personnes - avec conseils pour adapter les portions]
• Budget : [€ Économique / €€ Moyen / €€€ Premium]
• Saison idéale : [Quand c'est le meilleur moment pour la faire]

**🛒 La Liste des Courses Détaillée**
[Liste très précise avec grammes/volumes exacts]
• Ingrédient 1 : [Quantité + description détaillée + où le trouver]
• Ingrédient 2 : [Quantité + description détaillée + où le trouver]
...
💡 Alternatives possibles :
• [Option 1 si ingrédient pas dispo]
• [Option 2 si ingrédient pas dispo]
💫 Petits plus qui font la différence :
• [Ingrédient secret 1]
• [Ingrédient secret 2]

**🧰 L'Équipement du Chef**
[Liste détaillée de TOUS les ustensiles nécessaires]
• [Ustensile 1 : description et alternative possible]
• [Ustensile 2 : description et alternative possible]
...
🔧 Équipement optionnel mais pratique :
• [Ustensile bonus 1]
• [Ustensile bonus 2]

**🎯 Préparation Zen**
[Conseils pour bien s'organiser]
• [Comment disposer ses ingrédients]
• [Comment organiser son plan de travail]
• [Astuces pour gagner du temps]

**👩‍🍳 Action ! À Tes Fourneaux**
[Instructions hyper détaillées, étape par étape]
1. [Étape 1 avec temps précis + description sensorielle + points d'attention]
2. [Étape 2 avec temps précis + description sensorielle + points d'attention]
...
🎯 Points de vigilance pour chaque étape :
• [À quoi faire attention]
• [Comment savoir si on est sur la bonne voie]

**🔥 La Cuisson au Top**
• Température exacte : [X°C - avec explications scientifiques]
• Durée précise : [X minutes - avec tous les signes à surveiller]
• Position dans le four : [Haut/Milieu/Bas et pourquoi]
• Signes de cuisson parfaite :
  - [Signe visuel 1]
  - [Signe olfactif]
  - [Test de cuisson]

**💡 Les Secrets du Chef**
• [3-4 astuces pro détaillées]
• [Erreurs courantes et comment les éviter]
• [Techniques spéciales expliquées]
• [Conseils de pro avec humour]

**🎨 Variations Créatives**
• Version végétarienne : [Adaptation détaillée]
• Version express : [Version rapide]
• Version luxe : [Version gastronomique]
• Twist personnel : [Variation originale]

**🍽️ Dressage comme un Chef**
• [Description détaillée du dressage]
• [Conseils pour la présentation]
• [Idées de décoration]
• [Photos suggestions]

**🥂 Service et Accompagnements**
• [Température de service idéale]
• [Accompagnements parfaits]
• [Accords mets-vins]
• [Conseils de conservation]

**💪 Petits Encouragements**
[Messages motivants pour donner confiance]
[Rappel que les erreurs font partie de l'apprentissage]

Si ce n'est pas une demande de recette, réponds avec le même niveau de détail et d'enthousiasme en donnant des conseils culinaires personnalisés et encourageants !

Question : ${userMessage}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.9,
                        maxOutputTokens: 2048,
                        topP: 0.9,
                        topK: 40
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur API: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('Format de réponse invalide');
            }

            const generatedText = data.candidates[0].content.parts[0].text;
            
            // Vérifie si la réponse contient du texte
            if (!generatedText || generatedText.trim() === '') {
                throw new Error('Réponse vide');
            }

            return generatedText;

        } catch (error) {
            console.error('Erreur détaillée:', error);
            
            // Vérifie si l'erreur est liée à la clé API
            if (error.message.includes('403') || error.message.includes('401')) {
                return "Il semble y avoir un problème avec la configuration. Je serai bientôt de retour pour t'aider à cuisiner !";
            }
            
            // Pour toute autre erreur
            return "Je suis là pour t'aider ! Dis-moi quelle recette tu voudrais préparer, et je te guiderai étape par étape.";
        } finally {
            this.isGenerating = false;
            this.controller = null;
        }
    }

    addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        let messageHTML = '';
        if (type === 'bot') {
            messageHTML = `
                <div class="bot-icon">
                    <img src="assets/chef-profile.jpg" alt="Chef Bernard">
                </div>
                <div class="message-content"></div>
            `;
            messageDiv.innerHTML = messageHTML;
            this.chatMessages.appendChild(messageDiv);
            this.scrollToBottom();
            
            // Ajouter l'effet de frappe pour les messages du bot
            const messageContent = messageDiv.querySelector('.message-content');
            this.typeMessage(content, messageContent);
        } else {
            messageHTML = `
                <div class="message-content">${this.formatMessage(content)}</div>
            `;
        messageDiv.innerHTML = messageHTML;
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        }
    }

    formatMessage(content) {
        return content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^- (.*)/gm, '<li><i class="fas fa-check"></i> $1</li>')
            .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    }

    addLoadingMessage() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message bot loading';
        loadingDiv.innerHTML = `
            <i class="fas fa-robot bot-icon"></i>
            <div class="message-content">
                <i class="fas fa-spinner fa-spin"></i> Je réfléchis à votre question...
            </div>
        `;
        this.chatMessages.appendChild(loadingDiv);
        this.scrollToBottom();
    }

    removeLoadingMessage() {
        const loadingMessage = this.chatMessages.querySelector('.loading');
        if (loadingMessage) {
            loadingMessage.remove();
        }
    }

    scrollToBottom() {
        // Défilement doux vers le bas avec requestAnimationFrame pour de meilleures performances
        if (this.chatMessages) {
            const lastMessage = this.chatMessages.lastElementChild;
            if (lastMessage) {
                // Utilisation de window.scrollTo pour défiler la page entière
                const offsetTop = lastMessage.offsetTop;
                const clientHeight = document.documentElement.clientHeight;
                const scrollY = offsetTop - clientHeight + lastMessage.offsetHeight + 120;
                
                window.scrollTo({
                    top: scrollY,
                    behavior: 'smooth'
                });
            }
        }
    }

    // Ajouter l'indicateur de frappe
    async addTypingIndicator() {
        // Créer le message avec l'indicateur de frappe
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot typing';
        typingDiv.innerHTML = `
            <div class="bot-icon chef-icon-thinking">
                <img src="assets/chef-profile.jpg" alt="Chef Kawsar">
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                </div>
            </div>
        `;

        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();

        // Afficher le bouton d'arrêt
        const stopButton = document.querySelector('.stop-generation');
        stopButton.classList.add('visible');

        // Attendre un court délai aléatoire pour simuler la réflexion
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
    }

    stopGeneration() {
        if (this.controller) {
            this.controller.abort();
            this.controller = null;
        }
        this.isGenerating = false;
        
        this.hideStopButton();
        
        const typingMessage = document.querySelector('.typing');
        if (typingMessage) {
            typingMessage.remove();
        }
        
        this.addMessage("J'ai arrêté ma réflexion. N'hésite pas à me poser une autre question !", 'bot');
    }

    showStopButton() {
        this.stopButton.style.display = 'flex';
        // Attendre le prochain frame pour ajouter la classe visible
        requestAnimationFrame(() => {
            this.stopButton.classList.add('visible');
        });
    }

    hideStopButton() {
        this.stopButton.classList.remove('visible');
        // Attendre la fin de l'animation avant de cacher complètement
        setTimeout(() => {
            this.stopButton.style.display = 'none';
        }, 300); // Durée de l'animation en ms
    }

    // Fonction pour l'effet de frappe fluide style ChatGPT
    async typeMessage(content, element) {
        this.isTyping = true;
        
        const formattedContent = this.formatMessage(content);
        element.innerHTML = ''; // Vider le contenu
        
        // Créer un élément temporaire pour parser le HTML formaté
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = formattedContent;
        
        // Fonction récursive pour traiter les nœuds HTML
        const processNode = async (node, targetElement) => {
            if (node.nodeType === Node.TEXT_NODE) {
                // Pour les nœuds texte, ajouter par groupes de mots pour un effet plus fluide
                const text = node.textContent;
                
                // Diviser le texte en segments (mots ou petits groupes de caractères)
                const segments = [];
                let currentSegment = '';
                let inTag = false;
                
                // Fonction pour ajouter un segment au tableau
                const addSegment = () => {
                    if (currentSegment.trim()) {
                        segments.push(currentSegment);
                        currentSegment = '';
                    }
                };
                
                // Diviser le texte en segments logiques
                for (let i = 0; i < text.length; i++) {
                    const char = text[i];
                    
                    // Gérer les balises HTML (ne pas les diviser)
                    if (char === '<') inTag = true;
                    if (inTag) {
                        currentSegment += char;
                        if (char === '>') inTag = false;
                        continue;
                    }
                    
                    // Ajouter le caractère au segment courant
                    currentSegment += char;
                    
                    // Créer un nouveau segment après certains caractères
                    if (['.', '!', '?', ',', ':', ';', '\n'].includes(char) || 
                        (char === ' ' && currentSegment.length > 5)) {
                        addSegment();
                    }
                }
                
                // Ajouter le dernier segment s'il existe
                addSegment();
                
                // Afficher les segments avec un délai
                for (let i = 0; i < segments.length; i++) {
                    const segment = segments[i];
                    const textNode = document.createTextNode(segment);
                    targetElement.appendChild(textNode);
                    this.scrollToBottom();
                    
                    // Déterminer la durée de la pause en fonction du segment
                    let pauseDuration = 10; // Pause de base
                    
                    // Pauses plus longues après certains caractères
                    const lastChar = segment.trim().slice(-1);
                    if (['.', '!', '?'].includes(lastChar)) {
                        pauseDuration = Math.random() * 100 + 50;
                    } else if ([',', ':', ';'].includes(lastChar)) {
                        pauseDuration = Math.random() * 50 + 30;
                    } else if (segment.includes('\n')) {
                        pauseDuration = Math.random() * 80 + 40;
                    } else {
                        // Pause normale entre les segments
                        pauseDuration = Math.random() * 20 + 10;
                    }
                    
                    // Ajouter des pauses aléatoires pour simuler la réflexion (rarement)
                    if (Math.random() < 0.02) {
                        pauseDuration += Math.random() * 200 + 100;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, pauseDuration));
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Pour les éléments HTML, créer un nouvel élément et traiter ses enfants
                const newElement = document.createElement(node.tagName);
                
                // Copier les attributs
                for (const attr of node.attributes) {
                    newElement.setAttribute(attr.name, attr.value);
                }
                
                targetElement.appendChild(newElement);
                
                // Traiter les enfants de manière récursive
                for (const childNode of node.childNodes) {
                    await processNode(childNode, newElement);
                }
            }
        };
        
        // Traiter tous les nœuds enfants de l'élément temporaire
        for (const childNode of tempDiv.childNodes) {
            await processNode(childNode, element);
        }
        
        this.isTyping = false;
    }

    // Fonctions pour la gestion des conversations
    generateConversationId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
    
    addMessageToCurrentConversation(type, content) {
        this.currentConversation.messages.push({
            type,
            content,
            timestamp: new Date()
        });
    }
    
    saveCurrentConversation(title) {
        // Mettre à jour le titre
        this.currentConversation.title = title;
        this.currentConversation.date = new Date();
        
        // Récupérer les conversations existantes
        let savedConversations = JSON.parse(localStorage.getItem('chefKawsarConversations') || '[]');
        
        // Vérifier si cette conversation existe déjà
        const existingIndex = savedConversations.findIndex(conv => conv.id === this.currentConversation.id);
        
        if (existingIndex !== -1) {
            // Mettre à jour la conversation existante
            savedConversations[existingIndex] = this.currentConversation;
        } else {
            // Ajouter la nouvelle conversation
            savedConversations.push(this.currentConversation);
        }
        
        // Sauvegarder dans le localStorage
        localStorage.setItem('chefKawsarConversations', JSON.stringify(savedConversations));
        
        // Mettre à jour l'affichage
        this.displaySavedConversations();
        
        // Afficher une notification
        this.showNotification('Conversation sauvegardée !');
    }
    
    loadSavedConversations() {
        const savedConversations = JSON.parse(localStorage.getItem('chefKawsarConversations') || '[]');
        this.displaySavedConversations(savedConversations);
    }
    
    displaySavedConversations(conversations = null) {
        if (!conversations) {
            conversations = JSON.parse(localStorage.getItem('chefKawsarConversations') || '[]');
        }
        
        const conversationsList = document.getElementById('conversationsList');
        
        if (conversations.length === 0) {
            conversationsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comment-dots"></i>
                    <p>Aucune discussion sauvegardée</p>
                </div>
            `;
            return;
        }
        
        // Trier par date (plus récent en premier)
        conversations.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        conversationsList.innerHTML = conversations.map(conv => {
            const date = new Date(conv.date);
            const formattedDate = date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="conversation-item" data-id="${conv.id}">
                    <div class="title">${conv.title}</div>
                    <div class="date">${formattedDate}</div>
                </div>
            `;
        }).join('');
        
        // Ajouter les écouteurs d'événements
        conversationsList.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const conversationId = item.dataset.id;
                this.loadConversation(conversationId);
            });
        });
    }
    
    loadConversation(conversationId) {
        const savedConversations = JSON.parse(localStorage.getItem('chefKawsarConversations') || '[]');
        const conversation = savedConversations.find(conv => conv.id === conversationId);
        
        if (!conversation) return;
        
        // Mettre à jour la conversation actuelle
        this.currentConversation = JSON.parse(JSON.stringify(conversation)); // Copie profonde
        this.currentConversationId = conversationId;
        
        // Effacer les messages actuels
        this.chatMessages.innerHTML = '';
        
        // Afficher les messages de la conversation
        conversation.messages.forEach(msg => {
            this.addMessage(msg.content, msg.type);
        });
        
        // Fermer le menu latéral sur mobile
        document.querySelector('.sidebar').classList.remove('active');
        
        // Afficher une notification
        this.showNotification('Conversation chargée !');
    }
    
    startNewConversation() {
        // Créer une nouvelle conversation
        this.currentConversationId = this.generateConversationId();
        this.currentConversation = {
            id: this.currentConversationId,
            title: 'Nouvelle conversation',
            date: new Date(),
            messages: []
        };
        
        // Effacer les messages actuels
        this.chatMessages.innerHTML = '';
        
        // Ajouter le message de bienvenue
        const welcomeMessage = `
            <h3>Bonjour, je suis Chef Kawsar ! 👩‍🍳</h3>
            <p>Je peux vous aider à :</p>
            <ul>
                <li><i class="fas fa-check"></i> Trouver des recettes</li>
                <li><i class="fas fa-check"></i> Donner des conseils de cuisine</li>
                <li><i class="fas fa-check"></i> Suggérer des alternatives aux ingrédients</li>
                <li><i class="fas fa-check"></i> Calculer les portions</li>
            </ul>
            <p>Que puis-je faire pour vous aujourd'hui ?</p>
        `;
        
        this.addMessage(welcomeMessage, 'bot');
        this.addMessageToCurrentConversation('bot', welcomeMessage);
        
        // Fermer le menu latéral sur mobile
        document.querySelector('.sidebar').classList.remove('active');
        
        // Afficher une notification
        this.showNotification('Nouvelle conversation démarrée !');
    }
    
    showNotification(message) {
        // Créer l'élément de notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        // Ajouter au DOM
        document.body.appendChild(notification);
        
        // Animer l'apparition
        setTimeout(() => {
            notification.classList.add('active');
        }, 10);
        
        // Supprimer après 3 secondes
        setTimeout(() => {
            notification.classList.remove('active');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    // Envoyer la requête à l'API
    async sendRequest(message) {
        try {
            await this.addTypingIndicator();
            
            // Autres parties du code existant ...
            
            // Lorsque la réponse est reçue, supprimer l'indicateur de frappe
            this.removeTypingIndicator();
            
            // Ajouter la réponse formatée
            this.addBotMessage(formattedResponse);
            
            // Autres parties du code existant ...
        } catch (error) {
            console.error('Erreur lors de la requête API:', error);
            
            // En cas d'erreur, supprimer l'indicateur de frappe
            this.removeTypingIndicator();
            
            // Afficher un message d'erreur
            this.addBotMessage("Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.");
        } finally {
            // Cacher le bouton d'arrêt
            const stopButton = document.querySelector('.stop-generation');
            stopButton.classList.remove('visible');
            
            this.isTyping = false;
        }
    }
}

// Remplacer la classe SidebarManager par une version simplifiée
function initializeSidebar() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    // Fonction pour ouvrir la sidebar
    function openSidebar() {
        document.body.classList.add('sidebar-open');
        
        // Forcer la visibilité sur mobile
        if (window.innerWidth <= 768) {
            sidebar.style.visibility = 'visible';
            sidebar.style.opacity = '1';
            sidebar.style.left = '0';
            
            // Désactiver le défilement du body
            document.body.style.overflow = 'hidden';
            
            // Forcer le rendu
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 50);
        }
        
        console.log('Sidebar ouverte');
    }

    // Fonction pour fermer la sidebar
    function closeSidebar() {
        document.body.classList.remove('sidebar-open');
        
        // Réactiver le défilement du body
        document.body.style.overflow = '';
        
        console.log('Sidebar fermée');
    }

    // Gestionnaire du bouton menu
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (document.body.classList.contains('sidebar-open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    // Gestionnaire de l'overlay
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            e.preventDefault();
            closeSidebar();
        });
    }

    // Empêcher la fermeture en cliquant dans la sidebar
    if (sidebar) {
        sidebar.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Gestionnaire des touches clavier
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
            closeSidebar();
        }
    });
}

// Initialiser la sidebar au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    initializeSidebar();
});

// Fonction pour afficher l'indicateur de frappe
function showTypingIndicator() {
    if (document.querySelector('.typing-indicator')) return;
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    
    const textElement = document.createElement('span');
    typingIndicator.appendChild(textElement);
    
    this.chatMessages.appendChild(typingIndicator);
    scrollToBottom();
}

// Fonction pour masquer l'indicateur de frappe
function hideTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
} 