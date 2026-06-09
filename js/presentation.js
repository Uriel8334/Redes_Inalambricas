/**
 * PresentationController
 * Clase para el control interactivo de la presentación de diapositivas
 */
class PresentationController {
    constructor(options = {}) {
        this.slides = [];
        this.currentSlide = 0;
        this.autoplayInterval = options.autoplayInterval || 5000;
        this.autoplayActive = false;
        this.autoplayTimer = null;
        this.autoplayStartTime = 0;
        this.autoplayRemaining = this.autoplayInterval;
        
        // Selectores de DOM
        this.slideSelector = options.slideSelector || '.slide-container';
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.counter = document.getElementById('slide-counter');
        
        // Elementos adicionales creados dinámicamente
        this.progressBar = null;
        this.menuDrawer = null;
        this.menuToggleBtn = null;
        this.autoplayBtn = null;
        this.fullscreenBtn = null;
        
        // Gestos táctiles
        this.touchStartX = 0;
        this.touchEndX = 0;
        
        // Animadores de diapositiva
        this.animators = {};
        this.activeAnimators = [];
    }

    /**
     * Inicializa la presentación
     */
    init() {
        this.slides = Array.from(document.querySelectorAll(this.slideSelector));
        if (this.slides.length === 0) return;

        // Crear controles adicionales
        this.createProgressBar();
        this.createSideMenu();
        this.createExtraControls();

        // Configurar Event Listeners
        this.setupEventListeners();
        
        // Inicializar Escalamiento Adaptativo
        this.setupAdaptiveScaling();

        // Leer diapositiva desde la URL (hash) o iniciar en 0
        const hash = window.location.hash;
        let startSlide = 0;
        if (hash && hash.startsWith('#slide-')) {
            const slideNum = parseInt(hash.replace('#slide-', ''), 10);
            if (!isNaN(slideNum) && slideNum >= 1 && slideNum <= this.slides.length) {
                startSlide = slideNum - 1;
            }
        }
        
        this.goTo(startSlide);
        this.initSlideAnimators();
        this.triggerSlideAnimators(this.currentSlide);
    }

    /**
     * Crea la barra de progreso superior
     */
    createProgressBar() {
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'presentation-progress-bar-container';
        
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'presentation-progress-bar';
        
        progressBarContainer.appendChild(this.progressBar);
        document.body.appendChild(progressBarContainer);

        // Hacer la barra clickeable para navegar
        progressBarContainer.addEventListener('click', (e) => {
            const rect = progressBarContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = clickX / rect.width;
            const targetIndex = Math.floor(percentage * this.slides.length);
            this.goTo(targetIndex);
        });
    }

    /**
     * Crea el menú de navegación lateral (Drawer)
     */
    createSideMenu() {
        // Crear contenedor del menú
        this.menuDrawer = document.createElement('div');
        this.menuDrawer.className = 'presentation-menu-drawer';
        
        const menuTitle = document.createElement('h3');
        menuTitle.innerText = 'Índice de Diapositivas';
        menuTitle.className = 'menu-drawer-title';
        this.menuDrawer.appendChild(menuTitle);

        const list = document.createElement('ul');
        list.className = 'menu-drawer-list';

        this.slides.forEach((slide, index) => {
            const li = document.createElement('li');
            li.className = 'menu-drawer-item';
            
            // Obtener el título de la diapositiva
            let title = `Diapositiva ${index + 1}`;
            const titleEl = slide.querySelector('.slide-title');
            const h1El = slide.querySelector('h1');
            if (titleEl) {
                title = titleEl.innerText;
            } else if (h1El) {
                title = h1El.innerText;
            }

            li.innerHTML = `<span class="menu-item-num">${index + 1}</span> <span class="menu-item-text">${title}</span>`;
            li.addEventListener('click', () => {
                this.goTo(index);
                this.toggleMenu(false);
            });
            list.appendChild(li);
        });

        this.menuDrawer.appendChild(list);
        document.body.appendChild(this.menuDrawer);

        // Crear botón para abrir el menú
        const controls = document.querySelector('.presentation-controls');
        if (controls) {
            this.menuToggleBtn = document.createElement('button');
            this.menuToggleBtn.id = 'menuToggleBtn';
            this.menuToggleBtn.title = 'Mostrar Índice (M)';
            this.menuToggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
            this.menuToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });
            // Insertar antes del contador
            controls.insertBefore(this.menuToggleBtn, this.counter);
        }

        // Cerrar menú al hacer clic afuera
        document.addEventListener('click', (e) => {
            if (this.menuDrawer.classList.contains('open') && !this.menuDrawer.contains(e.target) && e.target !== this.menuToggleBtn) {
                this.toggleMenu(false);
            }
        });
    }

    /**
     * Alterna la visibilidad del menú
     */
    toggleMenu(forceState = null) {
        if (forceState !== null) {
            if (forceState) {
                this.menuDrawer.classList.add('open');
                this.menuToggleBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            } else {
                this.menuDrawer.classList.remove('open');
                this.menuToggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
            }
        } else {
            const isOpen = this.menuDrawer.classList.toggle('open');
            this.menuToggleBtn.innerHTML = isOpen ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
        }

        // Resaltar elemento activo
        const items = this.menuDrawer.querySelectorAll('.menu-drawer-item');
        items.forEach((item, index) => {
            if (index === this.currentSlide) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * Crea controles adicionales (Autoplay, Pantalla Completa)
     */
    createExtraControls() {
        const controls = document.querySelector('.presentation-controls');
        if (!controls) return;

        // Botón Autoplay
        this.autoplayBtn = document.createElement('button');
        this.autoplayBtn.id = 'autoplayBtn';
        this.autoplayBtn.title = 'Reproducción Automática (A)';
        this.autoplayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        this.autoplayBtn.addEventListener('click', () => this.toggleAutoplay());
        controls.appendChild(this.autoplayBtn);

        // Botón Pantalla Completa
        this.fullscreenBtn = document.createElement('button');
        this.fullscreenBtn.id = 'fullscreenBtn';
        this.fullscreenBtn.title = 'Pantalla Completa (F)';
        this.fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        controls.appendChild(this.fullscreenBtn);
        
        // Evento para actualizar icono de pantalla completa si cambia el estado del sistema
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                this.fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
            } else {
                this.fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
            }
        });
    }

    /**
     * Configura los controladores de eventos
     */
    setupEventListeners() {
        // Botones de navegación
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => {
                this.stopAutoplay();
                this.prev();
            });
        }
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => {
                this.stopAutoplay();
                this.next();
            });
        }

        // Navegación por teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                this.stopAutoplay();
                this.next();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.stopAutoplay();
                this.prev();
            } else if (e.key === 'PageDown') {
                e.preventDefault();
                this.stopAutoplay();
                this.next();
            } else if (e.key === 'PageUp') {
                e.preventDefault();
                this.stopAutoplay();
                this.prev();
            } else if (e.key === 'Home') {
                e.preventDefault();
                this.stopAutoplay();
                this.goTo(0);
            } else if (e.key === 'End') {
                e.preventDefault();
                this.stopAutoplay();
                this.goTo(this.slides.length - 1);
            } else if (e.key.toLowerCase() === 'f') {
                this.toggleFullscreen();
            } else if (e.key.toLowerCase() === 'a') {
                this.toggleAutoplay();
            } else if (e.key.toLowerCase() === 'm') {
                this.toggleMenu();
            }
        });

        // Gestos táctiles
        document.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipeGesture();
        }, { passive: true });
    }

    /**
     * Procesa gestos táctiles de deslizamiento
     */
    handleSwipeGesture() {
        const threshold = 50; // Umbral de píxeles
        const diff = this.touchStartX - this.touchEndX;
        if (Math.abs(diff) > threshold) {
            this.stopAutoplay();
            if (diff > 0) {
                // Deslizar izquierda -> Siguiente
                this.next();
            } else {
                // Deslizar derecha -> Anterior
                this.prev();
            }
        }
    }

    /**
     * Configura el escalado proporcional de la presentación
     */
    setupAdaptiveScaling() {
        const adjustScale = () => {
            const container = document.getElementById('presentation-container');
            if (!container) return;

            const baseWidth = 1280;
            const baseHeight = 720;
            
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // Calcular escala ideal manteniendo relación de aspecto
            const scale = Math.min(windowWidth / baseWidth, windowHeight / baseHeight);
            
            // Aplicar escala al contenedor principal centrado
            container.style.transform = `scale(${scale})`;
            container.style.transformOrigin = 'center center';
        };

        window.addEventListener('resize', adjustScale);
        
        // Mutador para aplicar el ajuste cuando se activa la diapositiva
        this.onSlideChange = adjustScale;
    }

    /**
     * Va a la diapositiva siguiente
     */
    next() {
        if (this.currentSlide < this.slides.length - 1) {
            this.goTo(this.currentSlide + 1);
        } else if (this.autoplayActive) {
            // Reiniciar al principio en autoplay si llega al final
            this.goTo(0);
        }
    }

    /**
     * Va a la diapositiva anterior
     */
    prev() {
        if (this.currentSlide > 0) {
            this.goTo(this.currentSlide - 1);
        }
    }

    /**
     * Salta a una diapositiva específica
     */
    goTo(index) {
        if (index < 0 || index >= this.slides.length) return;
        
        // Detener animaciones previas
        this.stopActiveAnimators();
        
        this.currentSlide = index;
        
        // Actualizar vistas
        this.updateSlides();
        
        // Disparar animaciones de la diapositiva activa
        this.triggerSlideAnimators(index);
        
        // Si el autoplay está activo, reiniciar el timer
        if (this.autoplayActive) {
            this.startAutoplayTimer();
        }
    }

    /**
     * Actualiza el estado visual de la presentación
     */
    updateSlides() {
        this.slides.forEach((slide, index) => {
            if (index === this.currentSlide) {
                slide.classList.add('active');
            } else {
                slide.classList.remove('active');
            }
        });

        // Actualizar contador
        if (this.counter) {
            this.counter.innerText = `${this.currentSlide + 1} / ${this.slides.length}`;
        }

        // Habilitar/Deshabilitar botones
        if (this.prevBtn) this.prevBtn.disabled = this.currentSlide === 0;
        if (this.nextBtn) this.nextBtn.disabled = this.currentSlide === this.slides.length - 1;

        // Barra de progreso
        if (this.progressBar) {
            const percentage = ((this.currentSlide + 1) / this.slides.length) * 100;
            this.progressBar.style.width = `${percentage}%`;
        }

        // Actualizar URL hash
        window.history.replaceState(null, null, `#slide-${this.currentSlide + 1}`);

        // Callback para re-escalar
        if (this.onSlideChange) {
            // Ejecutar después de un breve delay para permitir el pintado
            setTimeout(this.onSlideChange, 10);
        }
    }

    /**
     * Alterna la reproducción automática
     */
    toggleAutoplay() {
        if (this.autoplayActive) {
            this.stopAutoplay();
        } else {
            this.startAutoplay();
        }
    }

    /**
     * Inicia la reproducción automática
     */
    startAutoplay() {
        this.autoplayActive = true;
        if (this.autoplayBtn) {
            this.autoplayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            this.autoplayBtn.classList.add('active');
            this.autoplayBtn.title = 'Pausar (A)';
        }
        this.startAutoplayTimer();
    }

    /**
     * Detiene la reproducción automática
     */
    stopAutoplay() {
        this.autoplayActive = false;
        if (this.autoplayBtn) {
            this.autoplayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            this.autoplayBtn.classList.remove('active');
            this.autoplayBtn.title = 'Reproducción Automática (A)';
        }
        if (this.autoplayTimer) {
            clearTimeout(this.autoplayTimer);
            this.autoplayTimer = null;
        }
        
        // Quitar indicador de temporizador si existe
        if (this.progressBar) {
            this.progressBar.classList.remove('animating');
            this.progressBar.style.transition = '';
        }
    }

    /**
     * Inicia el temporizador de autoplay
     */
    startAutoplayTimer() {
        if (this.autoplayTimer) {
            clearTimeout(this.autoplayTimer);
        }

        // Crear animación fluida en la barra de progreso
        if (this.progressBar) {
            // Forzar reflujo
            this.progressBar.style.transition = 'none';
            const percentageStart = (this.currentSlide / this.slides.length) * 100;
            const percentageEnd = ((this.currentSlide + 1) / this.slides.length) * 100;
            this.progressBar.style.width = `${percentageStart}%`;
            
            // Forzar reflujo de nuevo
            this.progressBar.offsetHeight;
            
            this.progressBar.style.transition = `width ${this.autoplayInterval}ms linear`;
            this.progressBar.style.width = `${percentageEnd}%`;
        }

        this.autoplayTimer = setTimeout(() => {
            this.next();
        }, this.autoplayInterval);
    }

    /**
     * Alterna el modo de pantalla completa
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error al intentar activar pantalla completa: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    /* ==========================================
       SECCIÓN DE ANIMADORES INTERACTIVOS CANVAS
       ========================================== */

    /**
     * Inicializa los objetos animadores
     */
    initSlideAnimators() {
        // Slide 4: Modulación de Radiofrecuencia (AM, FM, PM)
        this.animators[4] = new RfModulationAnimator('rf-modulation-canvas');

        // Slide 7: Tesla vs Marconi
        this.animators[7] = new TeslaMarconiAnimator('tesla-marconi-canvas');

        // Slide 10: Salto de Frecuencia (Hedy Lamarr)
        this.animators[10] = new FrequencyHoppingAnimator('frequency-hopping-canvas');

        // Slide 12: Banda ISM e Interferencia
        this.animators[12] = new IsmInterferenceAnimator('ism-interference-canvas');

        // Slide 14: Internet de las Cosas (IoT Malla)
        this.animators[14] = new IotMeshAnimator('iot-mesh-canvas');
    }

    /**
     * Detiene todas las animaciones activas
     */
    stopActiveAnimators() {
        this.activeAnimators.forEach(animator => {
            if (animator && typeof animator.stop === 'function') {
                animator.stop();
            }
        });
        this.activeAnimators = [];
    }

    /**
     * Dispara el animador correspondiente a la diapositiva actual
     * Nota: Los índices de diapositiva en el array son 0-indexed (diapositiva 4 = índice 3)
     */
    triggerSlideAnimators(slideIndex) {
        const slideNumber = slideIndex + 1;
        const animator = this.animators[slideNumber];
        if (animator) {
            animator.start();
            this.activeAnimators.push(animator);
        }
    }
}

/**
 * Clase Base para los Animadores de Diapositiva con Canvas
 */
class CanvasAnimator {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.running = false;
        this.time = 0;
    }

    start() {
        this.canvas = document.getElementById(this.canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.running = true;
        this.time = 0;
        
        // Ajustar resolución interna del canvas al tamaño del layout CSS
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * (window.devicePixelRatio || 1);
        this.canvas.height = rect.height * (window.devicePixelRatio || 1);
        this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        
        this.setup();
        this.loop();
    }

    stop() {
        this.running = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    setup() {
        // Por sobreescribir
    }

    loop() {
        if (!this.running) return;
        
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        this.ctx.clearRect(0, 0, width, height);
        this.update(width, height);
        this.draw(width, height);
        
        this.time += 0.05;
        this.animationId = requestAnimationFrame(() => this.loop());
    }

    update(width, height) {}
    draw(width, height) {}
}

/**
 * Animador de Modulación RF (AM, FM, PM)
 */
class RfModulationAnimator extends CanvasAnimator {
    setup() {
        this.currentMode = 'AM';
        // Configurar botones de modo interactivos en el DOM
        const container = this.canvas.parentElement;
        let modeControls = container.querySelector('.mode-controls');
        
        if (!modeControls) {
            modeControls = document.createElement('div');
            modeControls.className = 'mode-controls';
            modeControls.innerHTML = `
                <button class="mode-btn active" data-mode="AM">AM (Amplitud)</button>
                <button class="mode-btn" data-mode="FM">FM (Frecuencia)</button>
                <button class="mode-btn" data-mode="PM">PM (Fase)</button>
            `;
            container.appendChild(modeControls);
            
            // Event delegation para botones
            modeControls.addEventListener('click', (e) => {
                if (e.target.classList.contains('mode-btn')) {
                    modeControls.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.currentMode = e.target.getAttribute('data-mode');
                }
            });
        }
    }

    draw(width, height) {
        const ctx = this.ctx;
        
        // Fondos oscuros elegantes
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
        
        // Dibujar rejilla de fondo sutil
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 30) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Tres zonas para señales: Datos Digitales, Portadora Analógica, Señal Modulada
        const margin = 25;
        const rowHeight = (height - margin * 4) / 3;
        
        const y1 = margin + rowHeight / 2; // Datos Digitales
        const y2 = margin * 2 + rowHeight + rowHeight / 2; // Portadora
        const y3 = margin * 3 + rowHeight * 2 + rowHeight / 2; // Modulada
        
        // Frecuencia y velocidad
        const timeScale = this.time * 2;
        
        // 1. DIBUJAR SEÑAL DIGITAL DE DATOS
        ctx.strokeStyle = '#818cf8'; // Indigo
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        let lastDigitalVal = 0;
        for (let x = 0; x < width; x++) {
            // Determinar bit digital en la posición x
            const bitIndex = Math.floor((x + timeScale) / 80) % 6;
            // Secuencia de bits: [1, 0, 1, 1, 0, 1]
            const bits = [1, 0, 1, 1, 0, 0];
            const digitalVal = bits[bitIndex];
            const yOffset = digitalVal === 1 ? -rowHeight * 0.35 : rowHeight * 0.35;
            
            if (x === 0) {
                ctx.moveTo(x, y1 + yOffset);
            } else {
                // Dibujar flanco vertical si hay cambio
                if (digitalVal !== lastDigitalVal) {
                    const prevYOffset = lastDigitalVal === 1 ? -rowHeight * 0.35 : rowHeight * 0.35;
                    ctx.lineTo(x, y1 + prevYOffset);
                }
                ctx.lineTo(x, y1 + yOffset);
            }
            lastDigitalVal = digitalVal;
        }
        ctx.stroke();
        
        // Texto de datos digitales
        ctx.fillStyle = '#f8fafc';
        ctx.font = '13px Inter';
        ctx.fillText('Datos Digitales (Mensaje a enviar)', 15, y1 - rowHeight * 0.4);
        
        // 2. DIBUJAR PORTADORA ANALÓGICA
        ctx.strokeStyle = '#475569'; // Slate
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
            const y = y2 + Math.sin(x * 0.25 - timeScale * 1.5) * rowHeight * 0.35;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillText('Onda Portadora RF (Alta Frecuencia)', 15, y2 - rowHeight * 0.4);
        
        // 3. DIBUJAR SEÑAL MODULADA SEGÚN EL MODO
        ctx.strokeStyle = '#38bdf8'; // Cyan
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        let phaseAccumulator = 0;
        let lastX = 0;
        
        for (let x = 0; x < width; x++) {
            const bitIndex = Math.floor((x + timeScale) / 80) % 6;
            const bits = [1, 0, 1, 1, 0, 0];
            const digitalVal = bits[bitIndex];
            
            let y = y3;
            const carrierFreq = 0.25;
            const carrierTime = timeScale * 1.5;
            
            if (this.currentMode === 'AM') {
                // Amplitud Modulada (AM)
                const ampFactor = digitalVal === 1 ? 1.0 : 0.25;
                y += Math.sin(x * carrierFreq - carrierTime) * (rowHeight * 0.35) * ampFactor;
            } else if (this.currentMode === 'FM') {
                // Frecuencia Modulada (FM)
                const freqFactor = digitalVal === 1 ? 2.2 : 0.8;
                phaseAccumulator += carrierFreq * freqFactor;
                y += Math.sin(phaseAccumulator - carrierTime) * rowHeight * 0.35;
            } else if (this.currentMode === 'PM') {
                // Modulación por Fase (PM)
                const phaseShift = digitalVal === 1 ? Math.PI : 0;
                y += Math.sin(x * carrierFreq - carrierTime + phaseShift) * rowHeight * 0.35;
            }
            
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px Poppins';
        ctx.fillText(`Señal Modulada en ${this.currentMode}`, 15, y3 - rowHeight * 0.4);
    }
}

/**
 * Animador de Tesla vs Marconi
 */
class TeslaMarconiAnimator extends CanvasAnimator {
    setup() {
        this.particles = [];
        this.sparks = [];
        this.towerWaves = [];
        this.sparkTimer = 0;
        this.particleTimer = 0;
    }

    update(width, height) {
        // Posición de los componentes en la pantalla de dos columnas
        const teslaX = width * 0.25;
        const teslaY = height * 0.6;
        const marconiX = width * 0.75;
        const marconiY = height * 0.6;
        
        // 1. Generar Rayos/Chispas en la bobina de Tesla de forma aleatoria
        this.sparkTimer++;
        if (this.sparkTimer > 5) {
            this.sparkTimer = 0;
            if (Math.random() < 0.6) {
                // Crear rayo de la esfera de la bobina al aire
                const rLength = 20 + Math.random() * 40;
                const rAngle = Math.random() * Math.PI * 2;
                this.sparks.push({
                    x1: teslaX,
                    y1: teslaY - 60,
                    x2: teslaX + Math.cos(rAngle) * rLength,
                    y2: teslaY - 60 + Math.sin(rAngle) * rLength,
                    life: 4 + Math.random() * 6
                });
            }
        }
        
        // Actualizar chispas
        this.sparks.forEach(s => s.life--);
        this.sparks = this.sparks.filter(s => s.life > 0);
        
        // 2. Generar partículas viajeras de Tesla a Marconi
        this.particleTimer++;
        if (this.particleTimer > 15) {
            this.particleTimer = 0;
            this.particles.push({
                x: teslaX,
                y: teslaY - 60 + (Math.random() - 0.5) * 20,
                targetX: marconiX,
                targetY: marconiY - 70,
                speed: 3 + Math.random() * 2,
                size: 2 + Math.random() * 4,
                glow: Math.random() * 10
            });
        }
        
        // Actualizar partículas
        this.particles.forEach(p => {
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 5) {
                // Colisión con la torre Marconi -> Emite onda de radio
                p.remove = true;
                this.towerWaves.push({
                    x: marconiX,
                    y: marconiY - 70,
                    radius: 5,
                    opacity: 1.0,
                    speed: 2
                });
            } else {
                // Avanzar con una onda sinusoidal suave en el eje Y
                p.x += (dx / dist) * p.speed;
                p.y += (dy / dist) * p.speed + Math.sin(p.x * 0.08) * 1.5;
            }
        });
        this.particles = this.particles.filter(p => !p.remove);
        
        // Actualizar ondas de radio de Marconi
        this.towerWaves.forEach(w => {
            w.radius += w.speed;
            w.opacity -= 0.015;
        });
        this.towerWaves = this.towerWaves.filter(w => w.opacity > 0);
    }

    draw(width, height) {
        const ctx = this.ctx;
        const teslaX = width * 0.25;
        const teslaY = height * 0.6;
        const marconiX = width * 0.75;
        const marconiY = height * 0.6;
        
        // Dibujar Bobina de Tesla
        // Base
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(teslaX - 40, teslaY, 80, 15);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(teslaX - 40, teslaY, 80, 15);
        
        // Bobina (Cilindro de cobre)
        const gradient = ctx.createLinearGradient(teslaX - 15, teslaY - 50, teslaX + 15, teslaY - 50);
        gradient.addColorStop(0, '#7c2d12');
        gradient.addColorStop(0.5, '#ea580c');
        gradient.addColorStop(1, '#7c2d12');
        ctx.fillStyle = gradient;
        ctx.fillRect(teslaX - 15, teslaY - 50, 30, 50);
        
        // Anillos de cobre (vueltas de la bobina)
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        for (let ry = teslaY - 45; ry < teslaY; ry += 6) {
            ctx.beginPath();
            ctx.moveTo(teslaX - 15, ry);
            ctx.lineTo(teslaX + 15, ry);
            ctx.stroke();
        }
        
        // Esfera superior brillante (Toroide)
        const sphereGlow = ctx.createRadialGradient(teslaX, teslaY - 60, 2, teslaX, teslaY - 60, 20);
        sphereGlow.addColorStop(0, '#f8fafc');
        sphereGlow.addColorStop(0.2, '#38bdf8');
        sphereGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = sphereGlow;
        ctx.beginPath();
        ctx.arc(teslaX, teslaY - 60, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.arc(teslaX, teslaY - 60, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Dibujar chispas de Tesla
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        this.sparks.forEach(s => {
            ctx.beginPath();
            ctx.moveTo(s.x1, s.y1);
            // Hacer el rayo "zigzagueante"
            const midX = (s.x1 + s.x2) / 2 + (Math.random() - 0.5) * 8;
            const midY = (s.y1 + s.y2) / 2 + (Math.random() - 0.5) * 8;
            ctx.lineTo(midX, midY);
            ctx.lineTo(s.x2, s.y2);
            ctx.stroke();
        });
        
        // Reset de sombras para evitar ralentización
        ctx.shadowBlur = 0;
        
        // Dibujar Antena de Marconi
        // Base de madera/metal
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(marconiX - 25, teslaY + 15);
        ctx.lineTo(marconiX, marconiY - 70);
        ctx.lineTo(marconiX + 25, teslaY + 15);
        ctx.moveTo(marconiX, marconiY - 70);
        ctx.lineTo(marconiX, teslaY + 15);
        ctx.stroke();
        
        // Refuerzos cruzados de la torre
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        for (let ty = marconiY - 50; ty < teslaY; ty += 20) {
            ctx.beginPath();
            ctx.moveTo(marconiX - 10, ty);
            ctx.lineTo(marconiX + 10, ty + 10);
            ctx.moveTo(marconiX + 10, ty);
            ctx.lineTo(marconiX - 10, ty + 10);
            ctx.stroke();
        }
        
        // Esfera receptora de Marconi
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(marconiX, marconiY - 70, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Dibujar partículas en tránsito
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        this.particles.forEach(p => {
            ctx.shadowBlur = p.glow;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;
        
        // Dibujar ondas electromagnéticas propagadas por Marconi
        this.towerWaves.forEach(w => {
            ctx.strokeStyle = `rgba(16, 185, 129, ${w.opacity})`; // Esmeralda para representar onda detectada
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
            ctx.stroke();
        });
        
        // Etiquetas explicativas
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Patentes y Transmisor', teslaX, teslaY + 35);
        ctx.fillText('Nikola Tesla (1897)', teslaX, teslaY + 50);
        
        ctx.fillText('Transmisión Trasatlántica', marconiX, teslaY + 35);
        ctx.fillText('Guglielmo Marconi (1901)', marconiX, teslaY + 50);
        
        // Línea divisoria de la historia
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
        ctx.beginPath();
        ctx.moveTo(width / 2, height * 0.1);
        ctx.lineTo(width / 2, height * 0.85);
        ctx.stroke();
    }
}

/**
 * Animador de Salto de Frecuencia (Hedy Lamarr)
 */
class FrequencyHoppingAnimator extends CanvasAnimator {
    setup() {
        this.channels = 8;
        this.activeChannel = 0;
        this.hopTimer = 0;
        this.hopHistory = [];
        this.channelColors = [
            '#ef4444', '#f97316', '#eab308', '#22c55e',
            '#06b6d4', '#3b82f6', '#6366f1', '#a855f7'
        ];
    }

    update(width, height) {
        this.hopTimer++;
        if (this.hopTimer > 15) { // Saltar de canal cada 15 cuadros (aprox. 300ms)
            this.hopTimer = 0;
            const prevChannel = this.activeChannel;
            
            // Generar nuevo canal aleatoriamente sin repetir el anterior
            do {
                this.activeChannel = Math.floor(Math.random() * this.channels);
            } while (this.activeChannel === prevChannel);
            
            // Guardar en el historial para pintar la línea del camino
            this.hopHistory.push({
                channel: this.activeChannel,
                time: Date.now()
            });
            
            if (this.hopHistory.length > 15) {
                this.hopHistory.shift();
            }
        }
    }

    draw(width, height) {
        const ctx = this.ctx;
        const colWidth = (width - 100) / this.channels;
        const graphHeight = height * 0.55;
        const startX = 50;
        const startY = 40;
        
        // Dibujar canales (Barras de espectro)
        for (let i = 0; i < this.channels; i++) {
            const rx = startX + i * colWidth;
            const isActive = i === this.activeChannel;
            
            // Dibujar fondo del canal
            ctx.fillStyle = isActive ? 'rgba(56, 189, 248, 0.15)' : '#1e293b';
            ctx.strokeStyle = isActive ? '#38bdf8' : '#334155';
            ctx.lineWidth = isActive ? 2 : 1;
            
            // Dibujar columna
            ctx.fillRect(rx + 5, startY, colWidth - 10, graphHeight);
            ctx.strokeRect(rx + 5, startY, colWidth - 10, graphHeight);
            
            // Dibujar antena o microchips en el canal activo
            if (isActive) {
                ctx.fillStyle = this.channelColors[i];
                ctx.fillRect(rx + 5, startY + graphHeight - 15, colWidth - 10, 15);
                
                // Brillo de frecuencia activa
                ctx.shadowColor = this.channelColors[i];
                ctx.shadowBlur = 15;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(rx + colWidth / 2, startY + 40, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            
            // Nombres de los canales / Frecuencias
            ctx.fillStyle = isActive ? '#38bdf8' : '#94a3b8';
            ctx.font = 'bold 12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(`Frec. ${i+1}`, rx + colWidth/2, startY + graphHeight + 20);
            ctx.font = '10px Inter';
            ctx.fillText(`${(2.402 + i * 0.005).toFixed(3)} GHz`, rx + colWidth/2, startY + graphHeight + 35);
        }
        
        // Dibujar trayectoria histórica de los "saltos" en una línea continua
        if (this.hopHistory.length > 1) {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            
            this.hopHistory.forEach((h, idx) => {
                const hx = startX + h.channel * colWidth + colWidth / 2;
                // Distribuir verticalmente basado en el tiempo
                const age = Date.now() - h.time;
                const hy = startY + graphHeight - (age * 0.05) % graphHeight;
                
                if (idx === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            });
            ctx.stroke();
            ctx.setLineDash([]); // Resetear
        }
        
        // Título explicativo
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 14px Poppins';
        ctx.textAlign = 'left';
        ctx.fillText('Espectro Ensanchado por Salto de Frecuencia (FHSS)', startX + 5, startY - 15);
        
        ctx.fillStyle = '#10b981';
        ctx.font = '12px Inter';
        ctx.fillText('● Patrón de salto secreto evita interferencias y espionaje militar.', startX + 5, startY + graphHeight + 65);
    }
}

/**
 * Animador de Banda ISM e Interferencia de Microondas (2.4 GHz)
 */
class IsmInterferenceAnimator extends CanvasAnimator {
    setup() {
        this.routerWaves = [];
        this.noiseWaves = [];
        this.routerWaveTimer = 0;
        this.noiseWaveTimer = 0;
        this.cleanChannel = false;
        this.channelShiftTimer = 0;
    }

    update(width, height) {
        const routerX = width * 0.25;
        const routerY = height * 0.55;
        const microwaveX = width * 0.75;
        const microwaveY = height * 0.55;
        
        this.channelShiftTimer++;
        if (this.channelShiftTimer > 180) { // Cambiar de canal limpio/sucio cada 3 segundos
            this.channelShiftTimer = 0;
            this.cleanChannel = !this.cleanChannel;
        }

        // Generar ondas del Router (Wi-Fi)
        this.routerWaveTimer++;
        if (this.routerWaveTimer > 30) {
            this.routerWaveTimer = 0;
            this.routerWaves.push({
                x: routerX,
                y: routerY,
                radius: 10,
                opacity: 1,
                // Si el canal está limpio, la frecuencia (velocidad de onda) es estable, si no, se distorsiona
                speed: 1.8
            });
        }

        // Generar ondas del Microondas (Interferencia)
        this.noiseWaveTimer++;
        if (this.noiseWaveTimer > 20) {
            this.noiseWaveTimer = 0;
            this.noiseWaves.push({
                x: microwaveX,
                y: microwaveY,
                radius: 10,
                opacity: 0.9,
                speed: 2.5,
                // Ondas distorsionadas (spiky)
                amplitude: 6 + Math.random() * 8
            });
        }

        // Actualizar ondas de Wi-Fi
        this.routerWaves.forEach(w => {
            w.radius += w.speed;
            w.opacity -= 0.007;
        });
        this.routerWaves = this.routerWaves.filter(w => w.opacity > 0);

        // Actualizar ondas de ruido del microondas
        this.noiseWaves.forEach(w => {
            w.radius += w.speed;
            w.opacity -= 0.012;
        });
        this.noiseWaves = this.noiseWaves.filter(w => w.opacity > 0);
    }

    draw(width, height) {
        const ctx = this.ctx;
        const routerX = width * 0.25;
        const routerY = height * 0.55;
        const microwaveX = width * 0.75;
        const microwaveY = height * 0.55;

        // Dibujar Router Wi-Fi
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.fillRect(routerX - 30, routerY, 60, 20);
        ctx.strokeRect(routerX - 30, routerY, 60, 20);
        
        // Antenas del Router
        ctx.beginPath();
        ctx.moveTo(routerX - 20, routerY);
        ctx.lineTo(routerX - 25, routerY - 35);
        ctx.moveTo(routerX + 20, routerY);
        ctx.lineTo(routerX + 25, routerY - 35);
        ctx.stroke();
        
        // Dibujar Horno de Microondas
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.fillRect(microwaveX - 40, microwaveY - 25, 80, 50);
        ctx.strokeRect(microwaveX - 40, microwaveY - 25, 80, 50);
        // Ventanilla del Microondas
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(microwaveX - 30, microwaveY - 15, 45, 30);
        ctx.strokeRect(microwaveX - 30, microwaveY - 15, 45, 30);
        // Botones del Microondas
        ctx.fillStyle = '#475569';
        ctx.fillRect(microwaveX + 20, microwaveY - 15, 12, 30);
        
        // Dibujar ondas Wi-Fi (Canal Azul / Canal Esmeralda si cambió)
        this.routerWaves.forEach(w => {
            ctx.lineWidth = 2.5;
            if (this.cleanChannel) {
                // Representa Wi-Fi que saltó a un canal limpio (ej. 5GHz o canal 11)
                ctx.strokeStyle = `rgba(16, 185, 129, ${w.opacity})`; // Esmeralda
            } else {
                ctx.strokeStyle = `rgba(56, 189, 248, ${w.opacity})`; // Cyan original
            }
            
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Dibujar ondas de interferencia de microondas (Ondas rojas con ruido)
        this.noiseWaves.forEach(w => {
            ctx.strokeStyle = `rgba(239, 68, 68, ${w.opacity})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            
            // Dibujar círculo distorsionado (ruido sinusoidal acoplado a la onda)
            const numPoints = 60;
            for (let i = 0; i <= numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                // El radio se perturba con seno para crear ruido
                const distortion = Math.sin(angle * 12 + this.time * 5) * (w.amplitude || 5);
                const r = w.radius + distortion;
                const px = w.x + Math.cos(angle) * r;
                const py = w.y + Math.sin(angle) * r;
                
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        });

        // Dibujar zona de colisión / interferencia
        if (!this.cleanChannel) {
            // Si está en el mismo canal (2.4 GHz sin filtrar), colisionan en el centro
            const centerX = (routerX + microwaveX) / 2;
            const centerY = (routerY + microwaveY) / 2;
            
            // Efecto de chispa / ruido de colisión
            ctx.shadowColor = '#eab308'; // Amarillo
            ctx.shadowBlur = 15;
            ctx.fillStyle = 'rgba(234, 179, 8, 0.4)';
            ctx.beginPath();
            ctx.arc(centerX, centerY + (Math.random() - 0.5) * 40, 15 + Math.random() * 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Leyendas de texto
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 13px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Router Wi-Fi (2.4 GHz)', routerX, routerY - 50);
        ctx.fillText('Horno de Microondas (Ruido 2.45 GHz)', microwaveX, microwaveY - 40);
        
        // Cuadro de estado dinámico
        const statusBoxX = width / 2 - 140;
        const statusBoxY = height * 0.82;
        
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = this.cleanChannel ? '#10b981' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.fillRect(statusBoxX, statusBoxY, 280, 40);
        ctx.strokeRect(statusBoxX, statusBoxY, 280, 40);
        
        ctx.fillStyle = this.cleanChannel ? '#10b981' : '#f87171';
        ctx.font = 'bold 12px Inter';
        ctx.fillText(
            this.cleanChannel ? 'ESTADO: Canal Limpio (Salto Automático)' : 'ESTADO: Interferencia Detectada en Canal 6',
            width / 2,
            statusBoxY + 24
        );
    }
}

/**
 * Animador de Red de Malla Internet de las Cosas (IoT)
 */
class IotMeshAnimator extends CanvasAnimator {
    setup() {
        this.nodes = [];
        this.connections = [];
        this.dataPackets = [];
        this.packetTimer = 0;

        // Configurar los nodos en círculo
        const icons = [
            'fa-house-signal',        // Casa inteligente
            'fa-car-rear',            // Vehículo autónomo
            'fa-thermometer-half',    // Sensor industrial
            'fa-heart-pulse',         // Reloj inteligente
            'fa-bolt-lightning',      // Medidor de energía
            'fa-cloud',               // Nube / Servidor Central
            'fa-mobile-screen-button' // Teléfono móvil
        ];

        const nodeNames = [
            'Smart Home', 'Connected Car', 'Sensor M2M',
            'Wearable', 'Smart Grid', 'Cloud Data', 'Mobile User'
        ];

        const numNodes = icons.length;
        const radius = 140;

        // Generar nodos
        for (let i = 0; i < numNodes; i++) {
            const angle = (i / numNodes) * Math.PI * 2 - Math.PI / 2;
            this.nodes.push({
                id: i,
                name: nodeNames[i],
                icon: icons[i],
                angle: angle,
                // Estos valores se calcularán dinámicamente en draw/update
                x: 0,
                y: 0,
                pulseRadius: 0,
                hovered: false
            });
        }
    }

    update(width, height) {
        const centerX = width / 2;
        const centerY = height * 0.5;
        const radius = 140;

        // Actualizar coordenadas fijas de los nodos
        this.nodes.forEach(n => {
            n.x = centerX + Math.cos(n.angle + this.time * 0.02) * radius;
            n.y = centerY + Math.sin(n.angle + this.time * 0.02) * radius;
            n.pulseRadius = 25 + Math.sin(this.time * 2 + n.id) * 3;
        });

        // Generar nuevos paquetes de datos fluyendo entre nodos aleatorios
        this.packetTimer++;
        if (this.packetTimer > 25 && this.nodes[0].x !== 0) {
            this.packetTimer = 0;
            // Elegir nodo origen y destino aleatorios
            const fromIdx = Math.floor(Math.random() * this.nodes.length);
            let toIdx = Math.floor(Math.random() * this.nodes.length);
            while (toIdx === fromIdx) {
                toIdx = Math.floor(Math.random() * this.nodes.length);
            }
            
            const fromNode = this.nodes[fromIdx];
            const toNode = this.nodes[toIdx];
            
            this.dataPackets.push({
                x: fromNode.x,
                y: fromNode.y,
                startX: fromNode.x,
                startY: fromNode.y,
                endX: toNode.x,
                endY: toNode.y,
                progress: 0,
                speed: 0.015 + Math.random() * 0.01
            });
        }

        // Actualizar paquetes de datos
        this.dataPackets.forEach(p => {
            p.progress += p.speed;
            if (p.progress > 1) {
                p.remove = true;
            } else {
                // Interpolación lineal
                p.x = p.startX + (p.endX - p.startX) * p.progress;
                p.y = p.startY + (p.endY - p.startY) * p.progress;
            }
        });
        this.dataPackets = this.dataPackets.filter(p => !p.remove);
    }

    draw(width, height) {
        const ctx = this.ctx;
        const centerX = width / 2;
        const centerY = height * 0.5;

        // 1. Dibujar líneas de conexión de malla entre nodos
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.12)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                ctx.beginPath();
                ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
                ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
                ctx.stroke();
            }
        }

        // 2. Dibujar paquetes de datos flotando por las líneas
        ctx.fillStyle = '#38bdf8'; // Cyan
        ctx.shadowColor = '#38bdf8';
        this.dataPackets.forEach(p => {
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0; // Reset

        // 3. Dibujar Nodos del IoT
        this.nodes.forEach(n => {
            // Brillo de fondo del nodo
            const grad = ctx.createRadialGradient(n.x, n.y, 5, n.x, n.y, n.pulseRadius);
            grad.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
            grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.pulseRadius, 0, Math.PI * 2);
            ctx.fill();

            // Cuerpo del nodo (Círculo de microchip)
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(n.x, n.y, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Nombre del nodo en el espectro
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(n.name, n.x, n.y - 25);
            
            // Dibujar ícono alternativo (Un punto brillante central ya que FontAwesome se renderiza en HTML)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // Eje central de la red (Nube)
        ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 45, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Malla M2M', centerX, centerY + 5);
    }
}
