function(instance, properties, context) {

  const canvasId = properties.canvas_id;

  let isGeneratingImage = false;
  let isUpdatingLayers = false;
  let updateLayersTimeout = null;
  let isUserMovingObjects = false; // Flag para detectar movimentação
  let lastRenderTime = 0; // Controle de tempo para throttling
  let lastImageGenerationTime = 0; // Última vez que uma imagem foi gerada

  // Debounce e throttling configuráveis
  const UPDATE_DELAY = 1000; // ms de debounce para atualizações padrão
  const UPDATE_DELAY_DURING_MOVEMENT = 2000; // ms durante movimentação
  const RENDER_THROTTLE = 250; // ms mínimo entre renderizações durante movimentação
  const IMAGE_GENERATION_THROTTLE = 1500; // ms mínimo entre gerações de imagem quando parado
  const IMAGE_GENERATION_THROTTLE_DURING_MOVEMENT = 3000; // ms durante movimentação

  // Qualidade de imagem configurável
  const IMAGE_QUALITY_NORMAL = 1.0; // Qualidade normal (alta)
  const IMAGE_QUALITY_DURING_MOVEMENT = 0.6; // Qualidade reduzida durante movimentação
  const IMAGE_SCALE_NORMAL = 1.0; // Escala normal
  const IMAGE_SCALE_DURING_MOVEMENT = 0.7; // Escala reduzida durante movimentação

  // Contador para movimento contínuo
  let continuousMovementCounter = 0;
  const CONTINUOUS_MOVEMENT_THRESHOLD = 5; // Número de eventos de movimento para considerar "movimento contínuo"

  // Contadores para diagnóstico
  let renderCounter = 0;
  let updateLayersCounter = 0;
  let generateImageCounter = 0;

  let lastKnownWidth = properties.bubble.width();
  let lastKnownHeight = properties.bubble.height();

  const ELEMENTOS_IGNORADOS_TEXTO = []; //'textcta', 'editname', 'editwhats', 'editendereco'
  const ELEMENTOS_IGNORADOS_IMAGEM = ['logo']; //'editfotoperfil', 'logo', 'editfotofundo', 'editfotoproduto'
  const ELEMENTOS_DINAMICOS_IMAGEM = ['editfotoperfil', 'editfotofundo', 'editfotoproduto'];
    
  // Sistema de controle de renderização - MOVIDO PARA CÁ
  let renderQueue = [];
  let isRenderScheduled = false;
  let lastFrameTime = 0;
  const FRAME_RATE_LIMIT_DURING_MOVEMENT = 15; // Máximo de ~15 FPS durante movimentação (67ms)

  // Inicialização do objeto global de canvas
  if (!window.vpCanvas) window.vpCanvas = {};

  // Inicialização do objeto global de utilidades de canvas
  if (!window.vpCanvasUtils) window.vpCanvasUtils = {};

  /**
   * Verifica se a renderização deve ser suspensa para economizar recursos
   * @return {boolean} - Se deve suspender a renderização
   */
  function shouldSuspendRendering() {
    if (isGeneratingImage) return true;
    if (isUpdatingLayers) return true;
    return false;
  }

  /**
   * Otimiza o canvas para melhor desempenho durante interações
   * @param {boolean} highPerformance - Se true, ativa otimizações para movimento/interação
   */
  function optimizeCanvasForPerformance(highPerformance) {
    const canvas = window.vpCanvas[canvasId];
    if (highPerformance) {
      canvas.renderOnAddRemove = false;
      canvas.skipTargetFind = true;
      canvas.selection = false;
    } else {
      canvas.renderOnAddRemove = true;
      canvas.skipTargetFind = !properties.selection;
      canvas.selection = properties.selection;
    }
  }

  /**
   * Agenda uma renderização de forma eficiente usando requestAnimationFrame
   * @param {Function} renderFunction - Função a ser executada durante o próximo frame
   * @param {boolean} highPriority - Se a renderização tem alta prioridade
   */
  window.vpCanvasUtils.scheduleRender = function (renderFunction, highPriority = false) {
    if (highPriority) {
      renderQueue.unshift(renderFunction);
    } else {
      renderQueue.push(renderFunction);
    }

    if (isRenderScheduled) return;

    isRenderScheduled = true;

    fabric.util.requestAnimFrame(function processRenderQueue(timestamp) {
      const now = Date.now();

      if (isUserMovingObjects) {
        const timeSinceLastFrame = now - lastFrameTime;
        const frameTimeThreshold = 1000 / FRAME_RATE_LIMIT_DURING_MOVEMENT;

        if (timeSinceLastFrame < frameTimeThreshold) {
          isRenderScheduled = true;
          fabric.util.requestAnimFrame(processRenderQueue);
          return;
        }
      }

      let processed = 0;
      const maxProcessPerFrame = isUserMovingObjects ? 2 : 5;

      while (renderQueue.length > 0 && processed < maxProcessPerFrame) {
        const renderFn = renderQueue.shift();
        try {
          renderFn(timestamp);
        } catch (error) {
          // Erro ao processar renderização
        }
        processed++;
      }

      lastFrameTime = now;

      if (renderQueue.length > 0) {
        isRenderScheduled = true;
        fabric.util.requestAnimFrame(processRenderQueue);
      } else {
        isRenderScheduled = false;
      }
    });
  };

  const scheduleRender = window.vpCanvasUtils.scheduleRender;

  /**
   * Gera um ID aleatório com o comprimento especificado
   * @param {number} length - Comprimento do ID a ser gerado
   * @return {string} - ID aleatório gerado
   */
  function generateRandomId(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  /**
   * Obtém um ID único verificando os existentes no canvas
   * @param {Object} canvas - Instância do canvas Fabric.js
   * @return {string} - ID único gerado
   */
  function getUniqueId(canvas) {
    const existingIds = canvas.getObjects().map(obj => obj.id);
    let id;
    do {
      id = generateRandomId(8);
    } while (existingIds.includes(id));
    return id;
  }

  /**
   * Pesquisa um elemento no canvas com base no nome
   * @param {string} identificador - Nome do elemento a ser encontrado
   * @return {Object|null} - Objeto encontrado ou null
   */
  function procurarElemento(identificador) {
    return window.vpCanvas[canvasId].getObjects().find(obj => obj.name === identificador) || null;
  }

  /**
   * Aplica configurações otimizadas para objetos do canvas
   * @param {Object} obj - Objeto do Fabric.js
   */
  function otimizarObjeto(obj) {
    obj.objectCaching = true;

    if (!obj.selectable) {
      obj.hasControls = false;
      obj.hasBorders = false;
      obj.hasRotatingPoint = false;
      obj.lockMovementX = true;
      obj.lockMovementY = true;
    }

    if (obj.type === 'i-text' || obj.type === 'textbox') {
      obj.statefullCache = true;
      obj.dirty = true;
    }

    if (obj.type === 'image') {
      obj.noScaleCache = false;
    }
  }

  /**
  * Redimensiona o canvas e atualiza elementos
  */
  function resizeCanvas(newWidth, newHeight) {
    const canvas = window.vpCanvas[canvasId];
    if (!canvas) {
      console.log('❌ Canvas não encontrado para redimensionar');
      return;
    }

    // 1. Atualiza as dimensões do canvas Fabric.js
    canvas.setWidth(newWidth);
    canvas.setHeight(newHeight);

    // 2. Força atualização dos elementos HTML
    const lowerCanvas = canvas.lowerCanvasEl;
    const upperCanvas = canvas.upperCanvasEl;
    const wrapperEl = canvas.wrapperEl;

    if (lowerCanvas) {
      lowerCanvas.width = newWidth;
      lowerCanvas.height = newHeight;
      lowerCanvas.style.width = newWidth + 'px';
      lowerCanvas.style.height = newHeight + 'px';
    }

    if (upperCanvas) {
      upperCanvas.width = newWidth;
      upperCanvas.height = newHeight;
      upperCanvas.style.width = newWidth + 'px';
      upperCanvas.style.height = newHeight + 'px';
    }

    if (wrapperEl) {
      wrapperEl.style.width = newWidth + 'px';
      wrapperEl.style.height = newHeight + 'px';
    }

    // 3. Atualiza o retângulo de fundo
    const bgRect = procurarElemento('bgRect');
    if (bgRect) {
      bgRect.set({
        width: newWidth,
        height: newHeight
      });
      bgRect.setCoords();
    }

    // 4. Força renderização
    canvas.calcOffset();
    canvas.renderAll();

    // 5. Atualiza sistemas
    updateLayers(true, 'canvas-resize');
    generateImage(true, true);
  }

  /**
 * Verifica mudanças de tamanho com debounce otimizado
 */
  let sizeCheckTimeout = null;
  let lastCheckTime = 0;
  let isFirstCheck = true;

  function checkForSizeChanges() {
    const now = Date.now();

    // Para a primeira verificação, não aplica debounce
    if (!isFirstCheck && now - lastCheckTime < 200) return; // Reduzido de 500ms para 200ms

    const currentWidth = properties.bubble.width();
    const currentHeight = properties.bubble.height();

    const elementWidth = instance.canvas.width();
    const elementHeight = instance.canvas.height();

    // Usa o maior valor válido
    const finalWidth = (elementWidth > 50 && elementWidth > currentWidth) ? elementWidth : currentWidth;
    const finalHeight = (elementHeight > 50 && elementHeight > currentHeight) ? elementHeight : currentHeight;

    const canvasInstance = window.vpCanvas[canvasId];

    // Tolerância de 10px para evitar loops
    const needsResize = canvasInstance &&
      finalWidth > 50 && finalHeight > 50 &&
      (Math.abs(finalWidth - canvasInstance.width) > 10 ||
        Math.abs(finalHeight - canvasInstance.height) > 10);

    if (needsResize) {
      // Para primeira verificação ou mudanças grandes, executa imediatamente
      const sizeDiff = Math.abs(finalWidth - canvasInstance.width) + Math.abs(finalHeight - canvasInstance.height);
      const isLargeChange = sizeDiff > 100;

      clearTimeout(sizeCheckTimeout);

      const executeResize = () => {
        const roundedWidth = Math.round(finalWidth);
        const roundedHeight = Math.round(finalHeight);

        resizeCanvas(roundedWidth, roundedHeight);
        lastKnownWidth = roundedWidth;
        lastKnownHeight = roundedHeight;
        lastCheckTime = now;
        isFirstCheck = false;
      };

      // Se for primeira verificação ou mudança grande, executa imediatamente
      if (isFirstCheck || isLargeChange) {
        executeResize();
      } else {
        // Senão, aplica debounce mínimo de 50ms
        sizeCheckTimeout = setTimeout(executeResize, 50);
      }
    } else {
      lastCheckTime = now;
      isFirstCheck = false;
    }
  }


    /**
     * Gera um PNG do canvas atual sem alterar posições de nada
     * @param {boolean} force - ignora throttling se true
     * @param {boolean} isHighQuality - força qualidade alta se true
     * @return {Promise<string>} - URL da imagem exportada
     */
  function generateImage(force = false, isHighQuality = false) {
      const now = Date.now();
      const throttleTime = isUserMovingObjects
        ? IMAGE_GENERATION_THROTTLE_DURING_MOVEMENT
        : IMAGE_GENERATION_THROTTLE;

      if (!force && now - lastImageGenerationTime < throttleTime) {
        return Promise.resolve(null);
      }
      if (!force && isUserMovingObjects && continuousMovementCounter > CONTINUOUS_MOVEMENT_THRESHOLD) {
        return Promise.resolve(null);
      }
      if (isGeneratingImage && !force) {
        return Promise.resolve(null);
      }

      isGeneratingImage = true;
      generateImageCounter++;
      lastImageGenerationTime = now;

      // Calcula um multiplier alto quando highQuality=true
      // e considera também o devicePixelRatio para telas Retina
      const baseScale = isHighQuality ? 2 : 1;  
      const dpr = window.devicePixelRatio || 1;
      const multiplier = baseScale * dpr;

      const originalCanvas = window.vpCanvas[canvasId];

      // Garante que não exportamos nenhuma seleção visível
      //originalCanvas.discardActiveObject();
      originalCanvas.renderAll();

      // Exporta em PNG lossless, com bastante escala
      const dataUrl = originalCanvas.toDataURL({
        format: 'jpeg',
        quality: isHighQuality ? 0.95 : 0.7, // qualidade da imagem, ajustável conforme necessário
        multiplier: multiplier,
        enableRetinaScaling: false  // já incluímos o DPR manualmente
      });

      instance.publishState('imageExport', dataUrl);
      isGeneratingImage = false;
      return Promise.resolve(dataUrl);
    }

    

  /**
   * Atualiza informações das camadas do canvas com debounce adaptativo
   * @param {boolean} immediate - Se verdadeiro, ignora o debounce
   * @param {string} source - Fonte da chamada para fins de diagnóstico
   */
  function updateLayers(immediate = false, source = 'unknown') {
    updateLayersCounter++;

    // Sistema de debounce adaptativo baseado no contexto
    let delay = UPDATE_DELAY; // Delay padrão

    // Se estiver em movimentação e não for uma chamada imediata, usa debounce mais longo
    if (isUserMovingObjects && !immediate) {
      // Aumenta o debounce com base na intensidade do movimento
      const movementMultiplier = Math.min(2 + (continuousMovementCounter / 10), 4);
      delay = UPDATE_DELAY_DURING_MOVEMENT * movementMultiplier;
    }

    // Evita múltiplas chamadas em sequência rápida
    if (updateLayersTimeout) {
      clearTimeout(updateLayersTimeout);
    }

    // Se for imediato ou em prioridade máxima, executa diretamente
    if (immediate && !isUpdatingLayers) {
      // wait one frame so Fabric finishes its render first
      fabric.util.requestAnimFrame(() => executeUpdateLayers(source));
      return;
    }

    // Usa debounce para diminuir a frequência de atualizações
    updateLayersTimeout = setTimeout(function () {
      executeUpdateLayers(source);
    }, delay);
  }

  // ARRAY CENTRALIZADO DE TODAS AS PROPRIEDADES PERSONALIZADAS
  const CUSTOM_PROPS = [
    'name',
    'id',
    'changeToColor',
    'changeToColor2',
    'layerName',
    'isGradient',
    'clientSelectable',
    'selectedWidth',
    'selectedHeight',
    'gradientAngleLinear'
  ];

  /**
   * Implementação real da atualização de camadas
   * @param {string} source - Fonte da chamada para fins de diagnóstico
   */
  function executeUpdateLayers(source = 'unknown') {
    if (isUpdatingLayers) return;
    isUpdatingLayers = true;

    try {
      const canvas = window.vpCanvas[canvasId];
      if (!canvas) {
        return;
      }

      //  ─── Mantém o watermark no topo ───
      const watermark = canvas.getObjects().find(obj => obj.name === 'watermark');
      if (watermark) {
          // traz o obj para cima de todos
          canvas.bringToFront(watermark);
          // se quiser garantir uma renderização imediata:
          // canvas.requestRenderAll();
      }
        
      const canvasObjects = canvas.toJSON(CUSTOM_PROPS);
      instance.publishState('jsonLayers', JSON.stringify(canvasObjects));

      const layers = [];
      const ids = [];
      const texts = [];
      const fonts = [];
      const imageIds = [];
      const imageIds2 = [];
      const imageSrcs = [];
      const imageSrcs2 = [];
        
      const objects = canvas.getObjects();
      const typeMap = {
        'rect': 'Retângulo',
        'circle': 'Círculo',
        'triangle': 'Triângulo',
        'line': 'Linha',
        'image': 'Imagem',
        'i-text': 'Texto',
        'textbox': 'Caixa de Texto'
      };

      function safeNumber(value) {
        return typeof value === 'number' && !isNaN(value) ? value : 0;
      }

      objects.forEach(function (obj) {
        const name = obj.name || null;
        const id = obj.id || null;
        const type = name === 'bgRect' ? 'Fundo' : typeMap[obj.type] || obj.type;

        let fillColor = null;

        if (typeof obj.fill === 'string') {
          fillColor = obj.fill;
        } else if (obj.fill && obj.fill.colorStops) {
          fillColor = {
            type: obj.fill.type,
            coords: obj.fill.coords,
            colorStops: obj.fill.colorStops,
            gradientUnits: obj.fill.gradientUnits,
            gradientTransform: obj.fill.gradientTransform || null,
            offsetX: obj.fill.offsetX || 0,
            offsetY: obj.fill.offsetY || 0
          };
        }

        const strokeColor = (typeof obj.stroke === 'string' && /^#[0-9a-fA-F]{6}$/.test(obj.stroke)) ? obj.stroke : null;
        const color = obj.type === 'image' ? null : (obj.type === 'line' ? strokeColor : fillColor);

        const selectedWidth  = obj.width;
		const selectedHeight = obj.height;
          
        const x = safeNumber(obj.left);
        const y = safeNumber(obj.top);

        // Novas propriedades personalizadas
        const changeToColor = obj.changeToColor || null;
        const changeToColor2 = obj.changeToColor2 || null;
        const gradientAngleLinear = typeof obj.gradientAngleLinear === 'number' ? obj.gradientAngleLinear : null;
        const layerName = obj.layerName || type;
        const isGradient = !!obj.isGradient;
        const clientSelectable = typeof obj.clientSelectable === 'boolean' ? obj.clientSelectable : true;

        const text = obj.text || null;

        layers.push({
          id,
          name,
          //color, está duplicando o fill no JSON
          type,
          fill: fillColor,  // aqui já exporto o color e o gradiente
          changeToColor,
          changeToColor2,
          gradientAngleLinear,
          isGradient,
          clientSelectable,
          text,
          selectedWidth,
          selectedHeight,
          x,
          y,
          layerName,
          selectable: obj.selectable !== false
        });

        if ((obj.type === 'i-text' || obj.type === 'textbox') && !ELEMENTOS_IGNORADOS_TEXTO.includes(name) && clientSelectable !== false) {
          ids.push(id);
          texts.push(text);
          fonts.push(obj.fontFamily || '');
        }

          
        if (obj.type === 'image' && !ELEMENTOS_IGNORADOS_IMAGEM.includes(name) && clientSelectable !== false) {
          imageIds.push(id);
          // corrige a leitura da URL direto do elemento ou do método getSrc()
          var _src = '';
          if (obj._element && obj._element.src) {
            _src = obj._element.src;
          } else if (typeof obj.getSrc === 'function') {
            try { _src = obj.getSrc(); } catch (e) { /* silent */ }
          }
          imageSrcs.push(_src);
        }


        if (obj.type === 'image' && ELEMENTOS_DINAMICOS_IMAGEM.includes(name) && !ELEMENTOS_IGNORADOS_IMAGEM.includes(name) && clientSelectable !== false) {
          imageIds2.push(id);
          // corrige a leitura da URL direto do elemento ou do método getSrc()
          var _src = '';
          if (obj._element && obj._element.src) {
            _src = obj._element.src;
          } else if (typeof obj.getSrc === 'function') {
            try { _src = obj.getSrc(); } catch (e) { /* silent */ }
          }
          imageSrcs2.push(_src);
        }
          
          

        if (name === 'textcta') {
          instance.publishState('textCtaText', text || '');
          instance.publishState('textCtaId', id || '');
        }
      });

      layers.reverse();

      instance.publishState('allLayersInfo', JSON.stringify(layers));
      instance.publishState('textIdsList', ids);
      instance.publishState('textList', texts);
      instance.publishState('textFontsList', fonts);
      instance.publishState('imageIdsList', imageIds);
      instance.publishState('imageSrcsList', imageSrcs);
      instance.publishState('imageIdsListDynamics', imageIds2);
      instance.publishState('imageSrcsListDynamics', imageSrcs2);
        
      generateImage(true, true).then(function (img) {

      });

    } catch (err) {

    } finally {
      isUpdatingLayers = false;
    }
  }





  /**
   * Processa o objeto selecionado e publica seus estados
   * @param {Object} e - Evento de seleção
   */
  function passSelected(e) {
    const selectedObject = e.selected && e.selected[0];
    if (!selectedObject) {
      return;
    }

    // Valores padrão
    let objectType, objectColor, objectBorderRadius = null, objectOpacity;
    let objectWidth, objectHeight, objectPosX, objectPosY;
    let fontWeight = null, fontStyle = null, fontUnderline = null, fontFamily = null, fontSize = null;
    let textContent = null, imageSrc = null, imageMaskClipPath = null, imageMaskSrc = null;

    // Define propriedades com base no tipo de objeto
    switch (selectedObject.type) {
      case "rect":
        objectType = "retangulo";
        objectColor = selectedObject.fill;
        objectBorderRadius = selectedObject.rx;
        break;

      case "circle":
        objectType = "circulo";
        objectColor = selectedObject.fill;
        break;

      case "triangle":
        objectType = "triangulo";
        objectColor = selectedObject.fill;
        break;

      case "line":
        objectType = "linha";
        objectColor = selectedObject.stroke;
        break;

      case "image":
        objectType = "imagem";
        objectColor = null;
        imageSrc = selectedObject._element.src;
        imageMaskClipPath = selectedObject.clipPath || null;
        imageMaskSrc = (selectedObject.clipPath && selectedObject.clipPath._element && selectedObject.clipPath._element.src)
          ? selectedObject.clipPath._element.src
          : null;
        break;

      case "i-text":
      case "textbox":
        objectType = "texto";
        objectColor = selectedObject.fill;
        fontWeight = selectedObject.fontWeight;
        fontStyle = (selectedObject.fontStyle === 'italic');
        fontUnderline = selectedObject.get('underline');
        fontFamily = selectedObject.fontFamily;
        textContent = selectedObject.text;
        fontSize = selectedObject.fontSize;
        break;
    }

    // Propriedades comuns a todos os objetos
    objectOpacity = selectedObject.opacity;
    objectWidth = selectedObject.selectedWidth * selectedObject.scaleX;
    objectHeight = selectedObject.selectedHeight * selectedObject.scaleY;
    objectPosX = selectedObject.left;
    objectPosY = selectedObject.top;

    // Prepara JSON do objeto selecionado
    const selectedObjectJson = selectedObject.toJSON(); //const selectedObjectJson = selectedObject.toJSON(['name', 'id', 'changeToColor', 'selectable', 'layerName', 'isGradient', 'clientSelectable']);

      
    // Publica todos os estados do objeto selecionado
    instance.publishState('selected', JSON.stringify(selectedObjectJson));
    instance.publishState('type', objectType);

    function corValida(cor) {
      return typeof cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(cor);
    }

    // Detecta se é gradiente ou cor sólida
    if (typeof selectedObject.fill === "string" && corValida(selectedObject.fill)) {
      instance.publishState("fill", selectedObject.fill);
      instance.publishState("isGradient", false);
    } else if (selectedObject.fill && selectedObject.fill.colorStops) {
      const gradientData = {
        type: selectedObject.fill.type,
        coords: selectedObject.fill.coords,
        colorStops: selectedObject.fill.colorStops,
        gradientUnits: selectedObject.fill.gradientUnits,
        gradientTransform: selectedObject.fill.gradientTransform || null,
        offsetX: selectedObject.fill.offsetX || 0,
        offsetY: selectedObject.fill.offsetY || 0
      };
      instance.publishState("fill", gradientData);
      instance.publishState("isGradient", true);
    } else {
      instance.publishState("fill", "#000000"); // fallback padrão seguro
      instance.publishState("isGradient", false);
    }


    function safeNumber(value, fallback = 0) {
      return (typeof value === 'number' && !isNaN(value)) ? value : fallback;
    }


    instance.publishState("borderRadius", safeNumber(objectBorderRadius, 0));
    instance.publishState("opacity", safeNumber(objectOpacity, 1));
    instance.publishState("selectedWidth", safeNumber(objectWidth, 0));
    instance.publishState("selectedHeight", safeNumber(objectHeight, 0));
    instance.publishState("posX", safeNumber(objectPosX, 0));
    instance.publishState("posY", safeNumber(objectPosY, 0));
    instance.publishState("fontSize", String(safeNumber(fontSize, 12)));

    instance.publishState('fontWeight', typeof fontWeight === 'string' ? fontWeight : 'normal');
    instance.publishState('fontStyle', typeof fontStyle === 'boolean' ? fontStyle : false);
    instance.publishState('fontUnderline', typeof fontUnderline === 'boolean' ? fontUnderline : false);
    instance.publishState('fontFamily', typeof fontFamily === 'string' && fontFamily.length > 0 ? fontFamily : 'Arial');
    instance.publishState('textContent', typeof textContent === 'string' ? textContent : '');
    instance.publishState('imageSrc', typeof imageSrc === 'string' ? imageSrc : '');
    instance.publishState('imageMaskClipPath', typeof imageMaskClipPath === 'object' ? JSON.stringify(imageMaskClipPath) : 'null');
    instance.publishState('imageMaskSrc', typeof imageMaskSrc === 'string' ? imageMaskSrc : '');

    instance.triggerEvent('selectionModified');
  }

  /**
   * Gerencia o modo de edição do canvas (ativando/desativando detecção de objetos)
   * @param {boolean} isEditing - Se está em modo de edição
   */
  function toggleEditMode(isEditing) {
    const canvas = window.vpCanvas[canvasId];

    // Otimiza a detecção de objetos baseado no modo atual
    canvas.skipTargetFind = !isEditing;

    // Desseleciona qualquer objeto ativo
    if (!isEditing) {
      canvas.discardActiveObject().requestRenderAll();
    }
  }








  // ───────────────────────────────────────────────────────────
  // 🚩 1️⃣ Inicialização única do canvas + UNDO/REDO

  if (!window.vpCanvas[canvasId]) {

    // “monkey-patch” de toObject() para sempre incluir CUSTOM_PROPS
    (function (origToObject) {
      fabric.Object.prototype.toObject = function (additionalProps) {
        // concatena o que vier de chamada e nosso CUSTOM_PROPS
        const props = (additionalProps || []).concat(CUSTOM_PROPS);
        return origToObject.call(this, props);
      };
    })(fabric.Object.prototype.toObject);

    // Carregamento otimizado de fontes
    const fontsToLoad = [
      'Arial', 'Roboto', 'Open Sans', 'Montserrat', 'Lato',
      'Raleway', 'Playfair Display', 'Oswald', 'Josefin Sans',
      'Arvo', 'Pacifico', 'Antonio:700'
    ];

    // Detecta fontes já carregadas para evitar recarregamento
    const loadedFonts = [];
    const fontsToLoadFiltered = fontsToLoad.filter(font => {
      const fontAvailable = document.fonts &&
        Array.from(document.fonts).some(f => f.family.toLowerCase() === font.toLowerCase());
      if (fontAvailable) {
        loadedFonts.push(font);
        return false;
      }
      return true;
    });

    $(document).ready(function () {
      if (fontsToLoadFiltered.length > 0) {
        WebFont.load({
          google: {
            families: fontsToLoadFiltered
          },
          timeout: 2000
        });
      }
    });
      

    // Cria e adiciona o elemento canvas
    const canvasElement = $(`<canvas id="${canvasId}" width="${properties.bubble.width()}" height="${properties.bubble.height()}"></canvas>`);
    instance.canvas.append(canvasElement);

    // Inicializa o canvas Fabric.js com configurações otimizadas
    window.vpCanvas[canvasId] = new fabric.Canvas(canvasId, {
      stateful: true,
      selection: properties.selection,
      uniScaleTransform: true,
      allowTouchScrolling: true,
      preserveObjectStacking: true,
      enableRetinaScaling: false, // IMPORTANTE: desabilita escala automática
      devicePixelRatio: 1 // IMPORTANTE: força DPR como 1
    });
      

    // 🛠️ Capture a instância numa variável local e guarde no instance.data
    const canvas = window.vpCanvas[canvasId];
    instance.data.canvas = canvas;

    // TORNAR FUNÇÕES E TRIGGERS PÚBLICAS PARA PODER CHAMAR NAS AÇÕES
    canvas.vapt = {
          updateLayers: (immediate = false, source = 'external') => updateLayers(immediate, source),
          generateImage: (force = false, highQuality = true) => generateImage(force, highQuality),
          loadFromJSON: (json, cb) => window.vpCanvasUtils.loadFromJSON(canvasId, json, cb),
          saveState: (origin = 'manual') => instance.data.saveState(origin),
          undo: () => instance.data.undo(),
          redo: () => instance.data.redo(),
          //group: () => instance.data.groupSelection(),
          ungroup: () => instance.data.ungroupSelection(),

          resetHistoryUndo: () => {
            if (typeof instance.data.resetHistoryUndo === 'function') {
              instance.data.resetHistoryUndo();
            }
          }
    };

    canvas.vapt.trigger = function (eventName) {
      if (typeof instance.triggerEvent === 'function') {
        instance.triggerEvent(eventName);
      }
    };

    // -------------------------

    // ATUALIZA CAMADAS E A EXPORTA 
    updateLayers(true, 'initial-from-create');
    canvas.on('object:added', () => updateLayers(false, 'object:added'));
    canvas.on('object:removed', () => updateLayers(false, 'object:removed'));
    canvas.on('object:modified', () => updateLayers(false, 'object:modified'));

    // PUBLICA CONTAGEM DE ELEMENTOS SELECIONADOS
    function updateSelectionCount() {
      const count = canvas.getActiveObjects().length;
      instance.publishState('selectionCount', count);
    }

    // registre nos eventos de seleção
    canvas.on('selection:created', updateSelectionCount);
    canvas.on('selection:updated', updateSelectionCount);
    canvas.on('selection:cleared', () => instance.publishState('selectionCount', 0));

    // publica inicialmente (caso já haja seleção inicial)
    updateSelectionCount();

    // PUBLICA O TIPO DE SELEÇÃO, SE É APENAS UM OBJETO OU GRUPO
    function updateSelectionType() {
      const active = canvas.getActiveObject();

      if (!active) {
        instance.publishState('selectionType', null);
        instance.publishState('selectionGroup', false);
      } else {
        instance.publishState('selectionType', active.type);
        instance.publishState('selectionGroup', active.type === 'group');
      }
    }

    // registra nos eventos de seleção
    canvas.on('selection:created', function (e) {
      updateSelectionType();
      updateSelectionCount();
      passSelected(e);
    });

    canvas.on('selection:updated', function (e) {
      updateSelectionType();
      updateSelectionCount();
      passSelected(e);
    });

    canvas.on('selection:cleared', function () {
      updateSelectionType();
      updateSelectionCount();
      instance.triggerEvent('selectionCleared');
    });

      
    // ─── FUNÇÃO PARA FORÇAR TRAVAMENTO DO RETANGULO DE FUNDO ───
    function travarObjeto(obj) {
      obj.selectable = false;
      obj.evented = false;
      obj.hasBorders = false;
      obj.hasControls = false;
      obj.lockMovementX = true;
      obj.lockMovementY = true;
      obj.lockScalingX = true;
      obj.lockScalingY = true;
      obj.lockRotation = true;
      obj.hoverCursor = 'default';

      obj.on('selected', function () {
        const canvas = obj.canvas;
        if (canvas) {
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      });
    }
    //}



    // ─── ADICIONAR RETANGULO DE FUNDO ───
    const bgRect = new fabric.Rect({
      left: 0,
      top: 0,
      width: window.vpCanvas[canvasId].width,
      height: window.vpCanvas[canvasId].height,
      fill: properties.background_color,
      selectable: false,
      evented: false,

      hasBorders: false,
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,

      name: 'bgRect',
      id: getUniqueId(window.vpCanvas[canvasId])
    });
    //bgRect.excludeFromExport = true;
    travarObjeto(bgRect);
    canvas.add(bgRect);

    // sempre que algo for selecionado
    canvas.on('selection:created', function (e) {
      if (e.target && e.target.name === 'bgRect') {
        canvas.discardActiveObject();
      }
    });

      
      
    // ADICIONA RETÂNGULO COMO GUIA DE MARGENS DE SEGURANÇA
    instance.data.showCutLine = true;

    function createStaticGuideLines() {
      if (!instance.data.showCutLine) return;

      // Remove overlay existente se houver
      const existingOverlay = document.getElementById(`${canvasId}_guides_overlay`);
      if (existingOverlay) {
        existingOverlay.remove();
      }

      const canvasContainer = canvas.wrapperEl;
      const overlayCanvas = document.createElement('canvas');

      overlayCanvas.id = `${canvasId}_guides_overlay`;
      overlayCanvas.width = canvas.width;
      overlayCanvas.height = canvas.height;
      overlayCanvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 1000;
        opacity: 0.8;
      `;

      const ctx = overlayCanvas.getContext('2d');

      // Proporção 4:5
      const boxHeight = canvas.getHeight() + 1;
      const boxWidth = boxHeight * (4 / 5);
      const left = (canvas.getWidth() - boxWidth) / 2;
      const top = (canvas.getHeight() - boxHeight) / 2;

      // Configuração de linha
      //ctx.lineWidth = 1;
      ctx.lineWidth = 0.25;

      // 🔴 Retângulo externo (guia principal)
      if (canvasId === "vaptpost_canvas_designer" || canvasId === "vaptpost_canvas_user" ) { // Dessa forma se utilizar ID com outro nome, irá ficar sem as guias.
        ctx.strokeStyle = '#FF0000';
        ctx.strokeRect(left, top, boxWidth, boxHeight);
      }

      // 🔴 Retângulo interno (margem de segurança) - apenas para designer
      if (canvasId === "vaptpost_canvas_designer") {
        const ref = Math.min(boxWidth, boxHeight);
        const marginPx = ref * 0.05;

        ctx.strokeStyle = '#fab515';
        ctx.strokeRect(
          left + marginPx,
          top + marginPx,
          boxWidth - marginPx * 2,
          boxHeight - marginPx * 2
        );
      }

      canvasContainer.appendChild(overlayCanvas);

      // Retorna referência para poder atualizar depois se necessário
      return overlayCanvas;
    }

    // ✅ CHAMA APENAS UMA VEZ APÓS A INICIALIZAÇÃO DO CANVAS
    let guidesOverlay = null;
    setTimeout(() => {
      guidesOverlay = createStaticGuideLines();
    }, 200); // Pequeno delay para garantir que o canvas está pronto


/*
    // ✅ ATUALIZA APENAS QUANDO O CANVAS FOR REDIMENSIONADO
    // Adicione esta linha na função resizeCanvas() logo após canvas.renderAll():

    function updateGuidesOnResize() {
      if (guidesOverlay && instance.data.showCutLine) {
        guidesOverlay.remove();
        guidesOverlay = createStaticGuideLines();
      }
    }

    // ✅ FUNÇÃO PARA MOSTRAR/ESCONDER AS GUIAS (OPCIONAL)
    function toggleGuideLines(show) {
      instance.data.showCutLine = show;

      if (show && !guidesOverlay) {
        guidesOverlay = createStaticGuideLines();
      } else if (!show && guidesOverlay) {
        guidesOverlay.remove();
        guidesOverlay = null;
      }
    }

*/

      
      
    // 🛠️ INÍCIO: CONFIGURAÇÃO DE UNDO/REDO
    instance.data.undoStack = [];
    instance.data.redoStack = [];
    instance.data.isLoading = false;
    instance.data.MAX_HISTORY = 50;

    instance.publishState('canUndo', instance.data.undoStack.length > 1);
    instance.publishState('canRedo', instance.data.redoStack.length > 0);

    instance.data.saveState = function (eventName = 'manual') {
      if (instance.data.isLoading) return;

      const json = canvas.toJSON();
      json.objects = json.objects.filter(obj => !obj.excludeFromExport);

      const state = JSON.stringify(json);
      instance.data.redoStack.length = 0;

      if (instance.data.undoStack.length >= instance.data.MAX_HISTORY) {
        instance.data.undoStack.shift();
      }

      if (instance.data.undoStack[instance.data.undoStack.length - 1] !== state) {
        instance.data.undoStack.push(state);
      }

      instance.publishState('canUndo', instance.data.undoStack.length > 1);
      instance.publishState('canRedo', instance.data.redoStack.length > 0);
    };

      
      
    instance.data.loadState = function (state) {
        instance.data.isLoading = true; // Previne saveState de ser chamado durante este load
        canvas.loadFromJSON(state, function() { // Callback do loadFromJSON do Fabric
            // Os objetos agora estão carregados e revividos no canvas.

            canvas.getObjects().forEach(function(obj) {
                // Aplica a lógica de clientSelectable (originalmente presente)
                if (typeof obj.clientSelectable === 'boolean') {
                    obj.selectable = obj.clientSelectable;
                    if (!obj.clientSelectable) {
                        obj.hasControls = false;
                        obj.hasBorders = false;
                        obj.lockMovementX = true;
                        obj.lockMovementY = true;
                        obj.lockScalingX = true;
                        obj.lockScalingY = true;
                        obj.lockRotation = true;
                        obj.evented = false;
                        obj.hoverCursor = 'default';
                    }
                }
                // Otimiza o objeto (opcional, mas bom para consistência se o Fabric não o fizer completamente na revivificação)
                otimizarObjeto(obj);
            });

            const bg = procurarElemento('bgRect');
            if (bg) {
                travarObjeto(bg); // Garante que o bgRect está travado e com estilo correto
                canvas.sendToBack(bg); // Garante que está no fundo
            }

            canvas.renderAll();
            updateLayers(true, 'loadState-after-render'); // Atualiza as camadas para refletir o estado carregado

            instance.data.isLoading = false; // Finaliza o carregamento, permite saveState novamente
        });
    };
      
      

    instance.data.undo = function () {
      if (instance.data.undoStack.length > 1) {
        const curr = instance.data.undoStack.pop();
        instance.data.redoStack.push(curr);
        const prev = instance.data.undoStack[instance.data.undoStack.length - 1];
        instance.data.loadState(prev);
        instance.publishState('canUndo', instance.data.undoStack.length > 1);
        instance.publishState('canRedo', instance.data.redoStack.length > 0);
      }
      else {
        instance.publishState('canUndo', false);
      }
    };

    instance.data.redo = function () {
      if (instance.data.redoStack.length > 0) {
        const state = instance.data.redoStack.pop();
        instance.data.undoStack.push(state);
        instance.data.loadState(state);
        instance.publishState('canUndo', instance.data.undoStack.length > 1);
        instance.publishState('canRedo', instance.data.redoStack.length > 0);
      }
      else {
        instance.publishState('canRedo', false);
      }
    };

    // Estado inicial & listeners
    instance.data.saveState('initial');
    canvas.on('object:added', () => instance.data.saveState('object:added'));
    canvas.on('object:removed', () => instance.data.saveState('object:removed'));
    canvas.on('object:modified', () => instance.data.saveState('object:modified'));
    //canvas.on('mouse:up', () => instance.data.saveState('mouse:up'));

      
    //Função para resetar o histórico do Undo (Chamar após carregar JSON)
    instance.data.resetHistoryUndo = function () {
          if (instance && instance.data) {
              instance.data.undoStack = []  // Limpa desfazer
              instance.data.redoStack = []  // Limpa refazer

              // Salva estado atual como baseline, se função estiver disponível
              if (typeof instance.data.saveState === 'function') {
                  instance.data.saveState('json-loaded-baseline')
              }

              // Atualiza os estados expostos para refletir que não há histórico disponível
              if (typeof instance.publishState === 'function') {
                  instance.publishState('canUndo', false)
                  instance.publishState('canRedo', false)
              }
          }
    }

      
    // 🛠️ FIM: CONFIGURAÇÃO DE UNDO/REDO



    // ─── LISTENERS PARA TECLAS GLOBAIS ───
    $(document)
      .off('keydown.vpCanvas')
      .on('keydown.vpCanvas', function (e) {
        const canvas = window.vpCanvas[canvasId];
        
        
        // Verifica se o foco está em um input ou textarea (campo de texto)
        const isTypingInInput = document.activeElement &&
          (
            document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA' ||
            document.activeElement.isContentEditable
          );

        if (isTypingInInput) return; // Ignora atalhos se o usuário estiver digitando em um campo de texto

        

        // 🎯 MOVER OBJETO SELECIONADO COM SETAS
        const active = canvas.getActiveObject();
        if (active && !active.lockMovementX && !active.lockMovementY) {
          let moved = false;
          const moveBy = e.shiftKey ? 10 : 1;

          switch (e.key) {
            case 'ArrowUp':
              active.top -= moveBy;
              moved = true;
              break;
            case 'ArrowDown':
              active.top += moveBy;
              moved = true;
              break;
            case 'ArrowLeft':
              active.left -= moveBy;
              moved = true;
              break;
            case 'ArrowRight':
              active.left += moveBy;
              moved = true;
              break;
          }

          if (moved) {
            e.preventDefault();
            active.setCoords();
            canvas.requestRenderAll();
            updateLayers(true, 'keyboard-move');
            instance.data.saveState('arrow-move');
          }
        }

        // 💥 DELETE (Mac = Backspace, Windows = Delete)
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        const deleteKeyPressed = (
          (isMac && e.key === 'Backspace') ||
          (!isMac && (e.key === 'Delete' || e.keyCode === 46))
        );

        if (deleteKeyPressed) {
          const activeObject = canvas.getActiveObject();
          if (activeObject && !activeObject.lockMovementX && !activeObject.lockMovementY) {
            e.preventDefault();
            canvas.remove(activeObject);
            canvas.requestRenderAll();
            updateLayers(true, 'delete');
            instance.data.saveState('delete');
          }
        }

        // 🔙 ESC
        if (e.keyCode === 27) {
          canvas.discardActiveObject().requestRenderAll();
        }

        // ⌨️ UNDO (Ctrl/Cmd + Z)
        const mod = e.ctrlKey || e.metaKey;
        if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
          e.preventDefault();
          instance.data.undo();
        }

        // ↻ REDO (Ctrl/Cmd + Y) ou (Ctrl/Cmd + Shift + Z)
        if (mod && (
          (e.key === 'y' || e.key === 'Y') ||
          (e.shiftKey && (e.key === 'z' || e.key === 'Z'))
        )) {
          e.preventDefault();
          instance.data.redo();
        }

        // ⌨️ COPY (Ctrl/Cmd + C)
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          const active = canvas.getActiveObject();
          if (active) {
            instance.data.copiedObject = fabric.util.object.clone(active);
          }
        }

        // ⌨️ PASTE (Ctrl/Cmd + V)
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          const activeObject = canvas.getActiveObject();

          // Se um objeto de texto estiver em modo de edição, deixa o navegador lidar com Ctrl+V
          if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox') && activeObject.isEditing) {
            return;
          }

          // Caso contrário, trata como colagem de objeto do canvas
          e.preventDefault();
          const copied = instance.data.copiedObject;
          if (copied) {
            copied.clone(function (clone) {
              clone.set({
                left: (clone.left || 0) + 15,
                top: (clone.top || 0) + 15
              });
              canvas.add(clone);
              canvas.setActiveObject(clone);
              canvas.requestRenderAll();
              instance.data.saveState('paste');
              updateLayers(true, 'paste');
            });
          }
        }

        
        
      });



    // ─── ZOOM COM SHIFT + SCROLL ───
    canvas.on('mouse:wheel', function (opt) {
      if (!opt.e.shiftKey) return;

      opt.e.preventDefault();
      opt.e.stopPropagation();

      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;

      zoom = Math.max(1, Math.min(zoom, 4));

      const pointer = canvas.getPointer(opt.e);

      canvas.zoomToPoint({ x: pointer.x, y: pointer.y }, zoom);

      if (zoom === 1) {
        const vpt = canvas.viewportTransform;
        vpt[4] = 0;
        vpt[5] = 0;
      }

      updateLayers(true, 'mouse:wheel');
      canvas.requestRenderAll();
    });

    // ─── PAN COM SPACEBAR ───
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    // Eventos de teclado — SPACE
    $(document).off('keydown.pan').on('keydown.pan', function (e) {
      if (e.code === 'Space' && !isPanning) {
        isPanning = true;
        canvas.defaultCursor = 'grab';
        canvas.selection = false;
        canvas.skipTargetFind = true;
      }
    });

    $(document).off('keyup.pan').on('keyup.pan', function (e) {
      if (e.code === 'Space') {
        isPanning = false;
        canvas.defaultCursor = 'default';
        canvas.selection = properties.selection;
        canvas.skipTargetFind = !properties.selection;
      }
    });

    // Eventos de mouse
    canvas.on('mouse:down', function (opt) {
      if (!isPanning) return;
      panStart = {
        x: opt.e.clientX,
        y: opt.e.clientY
      };
    });

    canvas.on('mouse:move', function (opt) {
      if (!isPanning || !opt.e.buttons) return;

      const delta = {
        x: opt.e.clientX - panStart.x,
        y: opt.e.clientY - panStart.y
      };

      const vpt = canvas.viewportTransform;
      vpt[4] += delta.x;
      vpt[5] += delta.y;

      panStart = {
        x: opt.e.clientX,
        y: opt.e.clientY
      };

      canvas.requestRenderAll();
    });

    canvas.on('mouse:up', function () {
      panStart = { x: 0, y: 0 };
    });



    // ───  DESAGRUPA O GRUPO SELECIONADO ─── 
    instance.data.ungroupSelection = function () {
      const canvas = instance.data.canvas;
      const active = canvas.getActiveObject();
      if (!active || active.type !== 'group') return;

      active.toActiveSelection();
      canvas.requestRenderAll();

      canvas.discardActiveObject(); //Desativa a seleção dos elementos
      canvas.requestRenderAll();

      instance.data.saveState('ungroup');
    };

    // ───  VARIÁVEIS PARA FAZER CONTAGENS NO DEBUG DE PERFORMANCE ─── 
    let eventosPorSegundo = {
      render: 0,
      modified: 0,
      selection: 0
    };

    let contagemInterna = {
      render: 0,
      modified: 0,
      selection: 0
    };

    // MODO QUE MEMORIZA A POSIÇÃO INICIAL AO PRESSIONAR SHIFT E SOMENTE DEIXA ARRASTAR MOUSE NA DIREÇÃO INICIAL
    let initialPosition = null;
    let lockAxis = null;

    // AO MOVER UM OBJETO
    canvas.on('object:moving', function (opt) {
      const obj = opt.target;
      if (!obj) return;

      // 🧠 Aplicar otimizações durante movimento de textos
      if (obj.type === 'i-text' || obj.type === 'textbox') {
        obj._originalWidth = obj.width; // salva a largura antes do movimento
        obj.objectCaching = true;
        obj.statefullCache = true;
        obj.dirty = true;

        // 🔧 Otimiza a performance geral do canvas
        canvas.renderOnAddRemove = false;
        canvas.skipTargetFind = true;
        canvas.selection = false;
      }

      // 🧲 Travamento por eixo com SHIFT
      if (opt.e.shiftKey) {
        if (!initialPosition) {
          initialPosition = { left: obj.left, top: obj.top };
        }

        if (!lockAxis) {
          const deltaX = Math.abs(obj.left - initialPosition.left);
          const deltaY = Math.abs(obj.top - initialPosition.top);

          if (deltaX > 5 || deltaY > 5) {
            lockAxis = deltaX >= deltaY ? 'x' : 'y';
          }
        }

        if (lockAxis) {
          const grid = 20;
          if (lockAxis === 'x') {
            obj.set({
              top: initialPosition.top,
              left: Math.round(obj.left / grid) * grid
            });
          } else {
            obj.set({
              left: initialPosition.left,
              top: Math.round(obj.top / grid) * grid
            });
          }
        }
      } else {
        initialPosition = null;
        lockAxis = null;
      }
    });

    // 🛑 Restaura comportamento normal ao soltar o mouse
    canvas.on('mouse:up', function () {
      initialPosition = null;
      lockAxis = null;

      canvas.renderOnAddRemove = true;
      canvas.skipTargetFind = !properties.selection;
      canvas.selection = properties.selection;
    });

    // Otimiza o evento after:render para incluir monitoramento de performance
    let lastFrameTime = 0;
    let frameThrottle = 250;
    let canvasIsRendering = false;
    let imageGenScheduled = false; // ✅ controle de geração de imagem

    canvas.on('after:render', function () {
      const now = Date.now();
      const delta = now - lastFrameTime;

      if (canvasIsRendering) return;
      if (delta < frameThrottle) return;

      lastFrameTime = now;
      canvasIsRendering = true;

      window.vpCanvasUtils.scheduleRender(function () {
        try {
          const active = canvas.getActiveObject();
          if (active) {
            instance.publishState('selected', JSON.stringify(active.toJSON(['name', 'id'])));
          }

          // ✅ Gera imagem só quando não está em movimento nem em geração
          if (!isUserMovingObjects && !isGeneratingImage && !imageGenScheduled) {
            imageGenScheduled = true;
            generateImage(false, true).then(function () {   //MANTER O FALSE PARA UTILIZAR O THROTTLE PARA FICAR RÁPIDO NA EDIÇÃO E O TRUE, PARA EXPORTAR COM QUALIDADE ALTA A IMAGEM.
              imageGenScheduled = false;
            });
          }

        } catch (err) {

        } finally {
          canvasIsRendering = false;
        }
      });
    });




  }

  // FINAL DA INICIALIZAÇÃO ÚNICA
  // ───────────────────────────────────────────────────────────




  // Recupera a instância única
  const canvas = window.vpCanvas[canvasId];




  // ───────────────────────────────────────────────────────────
  // PARTE DA FUNÇÃO DE UNDO & REDO

  if (properties.undo_trigger) instance.data.undo();
  if (properties.redo_trigger) instance.data.redo();

  // ───────────────────────────────────────────────────────────
  // PARTE DA FUNÇÃO DE AGRUPAR E DESGRUPAR

  if (properties.group_trigger) instance.data.groupSelection();
  if (properties.ungroup_trigger) instance.data.ungroupSelection();



  canvas.on('selection:cleared', function () {
    // Lista de todos os estados que precisam ser limpos
    const allStatesToClear = [
      // Propriedades padrão
      'selected', 'type', 'color', 'fill', 'borderRadius', 'opacity',
      'selectedWidth', 'selectedHeight', 'posX', 'posY',

      // Fontes
      'fontWeight', 'fontStyle', 'fontUnderline', 'fontFamily', 'fontSize',

      // Texto
      'textContent',

      // Imagem
      'imageSrc', 'imageMaskClipPath', 'imageMaskSrc',

      // Gradient
      'isGradient',

      // Outros estados personalizados que você estiver usando
      'layerName', 'changeToColor', 'changeToColor2', 'clientSelectable',
      'gradientAngleLinear'
    ];

    // Limpa todos os estados
    allStatesToClear.forEach(state => {
      instance.publishState(state, null);
    });

    //updateLayers(true, 'selection:cleared');
    instance.triggerEvent('selectionCleared');
  });

  // Otimiza os objetos existentes no canvas
  canvas.getObjects().forEach(otimizarObjeto);

  // Força renderização otimizada após configuração
  fabric.util.requestAnimFrame(function () {
    canvas.requestRenderAll();
  });

    
    // <<< INÍCIO DA MODIFICAÇÃO PARA RESETAR O UNDO >>>
    if (instance && instance.data) { // Garante que instance.data está acessível
        instance.data.undoStack = []; // Limpa o histórico de Desfazer
        instance.data.redoStack = []; // Limpa o histórico de Refazer

        // Salva o estado atual (JSON carregado) como o novo baseline.
        // Com a lógica de canUndo (length > 1), o undo não estará disponível neste ponto.
        instance.data.saveState('json-loaded-baseline');
    }
    // <<< FIM DA MODIFICAÇÃO PARA RESETAR O UNDO >>>


    
    
  // Adicionar suporte para carregamento de JSON
  // Precisamos definir um método global para permitir que a ação acesse o sistema otimizado

  /**
   * Função global para carregar JSON no canvas respeitando o sistema de otimização
   * @param {string} targetCanvasId - ID do canvas alvo
   * @param {Object} jsonData - Dados JSON a serem carregados
   * @param {Function} callback - Função de callback após carregamento
   */
  window.vpCanvasUtils.loadFromJSON = function (targetCanvasId, jsonData, callback) {
    const targetCanvas = window.vpCanvas[targetCanvasId];
    if (!targetCanvas) {
      return;
    }

    // Desativa otimizações temporariamente durante o carregamento
    const wasMoving = isUserMovingObjects;
    isUserMovingObjects = false;

    // Limpa filas de renderização e atualizações
    if (renderQueue) {
      renderQueue = [];
    }
    if (updateLayersTimeout) {
      clearTimeout(updateLayersTimeout);
      updateLayersTimeout = null;
    }

    // Pausa a detecção de movimentos
    if (window.movementEndTimeout) {
      clearTimeout(window.movementEndTimeout);
    }

    // Restaura configurações originais para garantir carregamento correto
    optimizeCanvasForPerformance(false);

    // Força todas as atualizações pendentes antes do carregamento
    if (isUpdatingLayers) {
      // Espera a conclusão da atualização atual
      setTimeout(function () {
        _doLoadFromJSON();
      }, 100);
    } else {
      _doLoadFromJSON();
    }

    function _doLoadFromJSON() {
          targetCanvas.loadFromJSON(jsonData, function () {
              targetCanvas.getObjects().forEach(otimizarObjeto);
              isUserMovingObjects = wasMoving;
              targetCanvas.renderOnAddRemove = true;

              // ✅ Agora sim, após o canvas estar 100% pronto
              targetCanvas.renderAll();

              if (instance && instance.data && typeof instance.data.resetHistoryUndo === 'function') {
                instance.data.resetHistoryUndo();
              }

              scheduleRender(function () {
                targetCanvas.requestRenderAll();
                updateLayers(true, 'loadFromJSON');
                generateImage(true, true);
                if (typeof callback === 'function') {
                  callback();
                }
              }, true);
            });
     }
      
     
  };



  // Adicionar suporte otimizado para touchscreen
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isTouchDevice) {
    // Configura o canvas para suportar toque
    canvas.allowTouchScrolling = true;

    // Adiciona manipuladores de eventos touch otimizados
    let touchStartTime = 0;
    let touchMoveCount = 0;
    let lastTouchTime = 0;

    // Manipulador de início de toque
    canvas.on('touch:gesture', function (e) {
      // Se estiver realizando gesto de pinça (zoom), otimizar
      if (e.e.touches && e.e.touches.length > 1) {
        // Durante gestos com vários dedos, desativar renderização em tempo real
        if (!isUserMovingObjects) {
          isUserMovingObjects = true;
          optimizeCanvasForPerformance(true);
        }

        // Limpa timeout existente
        if (window.touchEndTimeout) {
          clearTimeout(window.touchEndTimeout);
        }

        // Define novo timeout
        window.touchEndTimeout = setTimeout(function () {
          isUserMovingObjects = false;
          optimizeCanvasForPerformance(false);
          updateLayers(true, 'touch:gesture:end');
          generateImage(true, true);
        }, 500);
      }
    });

    // Detector de movimento de touch otimizado
    canvas.on('touch:drag', function (e) {
      const now = Date.now();

      // Verifica se é o início de uma sequência de toques
      if (now - lastTouchTime > 1000) {
        touchMoveCount = 0;
        touchStartTime = now;
      }

      touchMoveCount++;
      lastTouchTime = now;

      // Ativa flag de movimentação
      if (!isUserMovingObjects && touchMoveCount > 2) {
        isUserMovingObjects = true;
        optimizeCanvasForPerformance(true);
      }

      // Limpa timeout existente
      if (window.touchEndTimeout) {
        clearTimeout(window.touchEndTimeout);
      }

      // Define novo timeout com tempo proporcional à duração do movimento
      window.touchEndTimeout = setTimeout(function () {
        isUserMovingObjects = false;
        optimizeCanvasForPerformance(false);
        updateLayers(true, 'touch:drag:end');
        generateImage(true, true);
        touchMoveCount = 0;
      }, 700); // Tempo maior para touch pois usuários de touch costumam ser mais lentos

      // Durante movimento contínuo de toque, atualiza camadas com menos frequência
      if (touchMoveCount % 15 === 0) { // Menor frequência para touch
        updateLayers(false, 'touch:drag');
      }
    });
  }

  // Verifica mudanças de tamanho de forma throttled
  checkForSizeChanges(); // Primeira verificação imediata

  // // Verificação rápida nos primeiros 5 segundos
  // let rapidCheckCount = 0;
  // const rapidCheckInterval = setInterval(() => {
  //   checkForSizeChanges();
  //   rapidCheckCount++;
  //   if (rapidCheckCount >= 10) { // Para após 10 verificações (5 segundos)
  //     clearInterval(rapidCheckInterval);
  //   }
  // }, 500); // A cada 500ms nos primeiros 5 segundos

  // // Verificação padrão menos frequente após o período inicial
  // if (!window.sizeCheckInterval) {
  //   setTimeout(() => {
  //     window.sizeCheckInterval = setInterval(() => {
  //       checkForSizeChanges();
  //     }, 2000); // A cada 2 segundos após o período inicial
  //   }, 5000);
  // }

  /*
  // ───────────────────────────────────────────────────────────
  // DEBUG DE PERFORMANCE — APENAS NO CONSOLE
 
 
 
  // Configura modo de edição baseado nas propriedades
  toggleEditMode(properties.selection);
  
  // Sistema de controle de renderização
  let lastFrameTimes = [];
  let averageFPS = 60;
  
  setInterval(function() {
      if (lastFrameTimes.length > 0) {
          // Calcula FPS médio
          const sum = lastFrameTimes.reduce((acc, time) => acc + time, 0);
          const avgFrameTime = sum / lastFrameTimes.length;
          averageFPS = Math.round(1000 / avgFrameTime);
          
          // Reset para o próximo intervalo
          lastFrameTimes = [];
      }
  }, 5000);
  
  // Modifica o sistema de renderização para monitorar performance
  function recordFrameTime() {
      const now = Date.now();
      if (lastFrameTime > 0) {
          const frameTime = now - lastFrameTime;
          lastFrameTimes.push(frameTime);
          
          // Limita o histórico para não consumir muita memória
          if (lastFrameTimes.length > 100) {
              lastFrameTimes.shift();
          }
      }
      lastFrameTime = now;
  }
  
  
  
  // Inicializa contadores de eventos
  let eventosPorSegundo = { render: 0, modified: 0, selection: 0 };
  let contagemInterna = { render: 0, modified: 0, selection: 0 };
 
  // Registra os contadores nos eventos relevantes
  canvas.on('after:render', () => contagemInterna.render++);
  canvas.on('object:modified', () => contagemInterna.modified++);
  canvas.on('selection:updated', () => contagemInterna.selection++);
 
  // Atualiza contadores a cada segundo
  setInterval(function () {
    eventosPorSegundo.render = contagemInterna.render;
    eventosPorSegundo.modified = contagemInterna.modified;
    eventosPorSegundo.selection = contagemInterna.selection;
 
    contagemInterna.render = 0;
    contagemInterna.modified = 0;
    contagemInterna.selection = 0;
  }, 1000);
 
  // Log no console a cada 10 segundos
  function logPainelDebug() {
    const objs = canvas.getObjects();
    const visiveis = objs.filter(o => o.visible !== false).length;
    const fps = averageFPS || 0;
    const zoom = (canvas.getZoom() * 100).toFixed(0);
    const tempos = lastFrameTimes.slice(-10);
    const tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
    const usandoCache = objs.filter(o => o.objectCaching).length;
    const listeners = Object.keys(canvas.__eventListeners || {}).map(e => canvas.__eventListeners[e].length).reduce((a, b) => a + b, 0);
    const undoLen = instance.data.undoStack ? instance.data.undoStack.length : 0;
    const redoLen = instance.data.redoStack ? instance.data.redoStack.length : 0;
 
    const logMsg = [
      '===== [Canvas Debug] =====',
      `🎞️ FPS médio:           ${fps}`,
      `🕒 ΔRender médio:       ${tempoMedio}ms`,
      `🧱 Objetos:             ${objs.length}`,
      `👁️ Visíveis:            ${visiveis}`,
      `📐 Zoom:                ${zoom}%`,
      `🧠 Objetos com cache:   ${usandoCache}`,
      `🎧 Listeners ativos:    ${listeners}`,
      `↩️ Undo:                ${undoLen} | Redo: ${redoLen}`,
      `🔁 after:render/s:      ${eventosPorSegundo.render}`,
      `✏️ object:modified/s:   ${eventosPorSegundo.modified}`,
      `🎯 selection:updated/s: ${eventosPorSegundo.selection}`,
      '========================='
    ].join('\n');
 
    console.log(logMsg);
  }
 
  setInterval(logPainelDebug, 10000);
  */


}