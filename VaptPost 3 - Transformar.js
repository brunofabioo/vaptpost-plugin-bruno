function(instance, properties, context) {
    
  const canvasId     = properties.canvasId;
  const canvas       = window.vpCanvas[canvasId];
  if (!canvas) return;
    
    
  // Timer para gerenciamento do debounce (mantido no escopo global para persistência)
  if (!window.debounceTimer) {
    window.debounceTimer = null;
  }

  /**
   * @function debounceIniciarCanvas
   * @description Gerencia o debounce para a função inicializarCanvas, garantindo que ela não seja chamada com muita frequência.
   */
  function debounceIniciarCanvas() {
    clearTimeout(window.debounceTimer); // Limpa o timer existente
    window.debounceTimer = setTimeout(inicializarCanvas, 500); // Define um novo timer
      
        // 1) Tenta converter properties.jsonData em objeto
        const rawJson = properties.jsonData;

        if (!rawJson) {
          // Se ainda não veio nenhum JSON, espera 300ms e tenta de novo
          setTimeout(inicializarCanvas, 300);
          return;
        }

        let jsonData = null;
        try {
          jsonData = JSON.parse(rawJson);
        } catch (e) {
          // Se a string estiver malformada, aborta mesmo
          instance.publishState("status", "finished");
          return;
        }   
  }

    
  /**
   * @function changeText
   * @description Altera o texto de um elemento iText do Fabric.js, ajustando seu tamanho e posição para caber no espaço original.
   * @param {fabric.IText} iTextElement - O objeto iText do Fabric.js a ser modificado.
   * @param {string} newText - O novo texto a ser aplicado.
   * @returns {fabric.IText} O objeto iText modificado.
   */
  function changeText(iTextElement, newText) {
  	
     if (iTextElement.type === "i-text") {
        // Armazena as dimensões e posições originais se ainda não o fez
        if (!iTextElement.originalWidth) {
          iTextElement.originalWidth = iTextElement.width * iTextElement.scaleX;
        }
        if (!iTextElement.originalHeight) {
          iTextElement.originalHeight = iTextElement.height * iTextElement.scaleY;
        }
        if (!iTextElement.originalTop) {
          iTextElement.originalTop = iTextElement.top;
        }
        if (!iTextElement.originalLeft) {
          iTextElement.originalLeft = iTextElement.left;
        }

        const originalWidth = iTextElement.originalWidth;
        const originalHeight = iTextElement.originalHeight;
        const originalTop = iTextElement.originalTop;
        const originalLeft = iTextElement.originalLeft;

        // Altera o texto do objeto
        iTextElement.set("text", newText);
        let newWidth = iTextElement.width * iTextElement.scaleX;
        let newHeight = iTextElement.height * iTextElement.scaleY;

        // Lógica de redimensionamento e centralização para caber no espaço original
        if (newWidth > originalWidth) {
          iTextElement.scaleX = originalWidth / iTextElement.width;
          iTextElement.scaleY = iTextElement.scaleX;
          newWidth = iTextElement.width * iTextElement.scaleX;
          newHeight = iTextElement.height * iTextElement.scaleY;

          if (newHeight > originalHeight) {
            iTextElement.scaleY = originalHeight / iTextElement.height;
            iTextElement.scaleX = iTextElement.scaleY;
            newWidth = iTextElement.width * iTextElement.scaleX;
            newHeight = iTextElement.height * iTextElement.scaleY;
          }

          // Centralizar horizontalmente após corrigir a largura
          iTextElement.left = (originalWidth - newWidth) / 2 + originalLeft;

          // Centralizar verticalmente após corrigir a altura
          iTextElement.top = (originalHeight - newHeight) / 2 + originalTop;
        } else {
          iTextElement.scaleY = originalHeight / iTextElement.height;
          iTextElement.scaleX = iTextElement.scaleY;
          newWidth = iTextElement.width * iTextElement.scaleX;
          newHeight = iTextElement.height * iTextElement.scaleY;

          if (newWidth > originalWidth) {
            iTextElement.scaleX = originalWidth / iTextElement.width;
            iTextElement.scaleY = iTextElement.scaleX;
            newWidth = iTextElement.width * iTextElement.scaleX;
            newHeight = iTextElement.height * iTextElement.scaleY;
          }

          // Centralizar horizontalmente após corrigir a largura
          iTextElement.left = (originalWidth - newWidth) / 2 + originalLeft;

          // Centralizar verticalmente após corrigir a altura
          iTextElement.top = (originalHeight - newHeight) / 2 + originalTop;
        }

        return iTextElement;
        
        
      } else if (iTextElement.type === "textbox") {
    		iTextElement.set("text", newText);
  	  }
	}
      
      

    function flattenGroups(jsonData) {
      var flattenedObjects = [];

      jsonData.objects.forEach(function (group) {
        // Se o grupo tiver nome 'logoagrupado', não desagrupa
        if (group.type === "group" && group.name === "logoagrupado") {
          flattenedObjects.push(group);
          return;
        }

        // Desagrupar somente grupos não marcados como 'logoagrupado'
        if (group.type === "group" && Array.isArray(group.objects)) {
          var groupLeft = group.left || 0;
          var groupTop = group.top || 0;
          var groupScaleX = group.scaleX || 1;
          var groupScaleY = group.scaleY || 1;
          var groupAngle = group.angle || 0;
          var originX = group.originX || "left";
          var originY = group.originY || "top";
          var groupWidth = group.width || 0;
          var groupHeight = group.height || 0;

          // Calcula o centro real do grupo no canvas
          var groupCenterX = groupLeft;
          var groupCenterY = groupTop;
          if (originX === "right") {
            groupCenterX = groupLeft - (groupWidth * groupScaleX) / 2;
          } else if (originX === "left") {
            groupCenterX = groupLeft + (groupWidth * groupScaleX) / 2;
          }

          if (originY === "bottom") {
            groupCenterY = groupTop - (groupHeight * groupScaleY) / 2;
          } else if (originY === "top") {
            groupCenterY = groupTop + (groupHeight * groupScaleY) / 2;
          }

          // Copia e ajusta cada filho
          var children = group.objects.map(function (child) {
            var copy = JSON.parse(JSON.stringify(child));
            copy.scaleX = (copy.scaleX || 1) * groupScaleX;
            copy.scaleY = (copy.scaleY || 1) * groupScaleY;
            copy.angle = (copy.angle || 0) + groupAngle;
            return copy;
          });

          // Determina os limites dos filhos
          var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          children.forEach(function (child) {
            var left = child.left || 0;
            var top = child.top || 0;
            var width = (child.width || 0) * (child.scaleX || 1);
            var height = (child.height || 0) * (child.scaleY || 1);
            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, left + width);
            maxY = Math.max(maxY, top + height);
          });

          var childrenCenterX = (minX + maxX) / 2;
          var childrenCenterY = (minY + maxY) / 2;

          var deltaX = groupCenterX - childrenCenterX;
          var deltaY = groupCenterY - childrenCenterY;

          // Ajusta posição e herda propriedades do grupo
          children.forEach(function (child) {
            child.left = (child.left || 0) + deltaX;
            child.top = (child.top || 0) + deltaY;

            if (group.name && !child.name) child.name = group.name;
            if (group.id && !child.id) child.id = group.id;
            if (typeof group.clientSelectable === "boolean" && typeof child.clientSelectable !== "boolean") {
              child.clientSelectable = group.clientSelectable;
            }

            flattenedObjects.push(child);
          });
        } else {
          // Não é grupo ou não possui objetos, mantém o elemento
          flattenedObjects.push(group);
        }
      });

      jsonData.objects = flattenedObjects;
    }

    

    function procurarElemento(jsonData, identificador) {
      function recurse(objects) {
        for (var i = 0; i < objects.length; i++) {
          var obj = objects[i];
          if (obj.name === identificador) return obj;
          if (obj.type === 'group' && Array.isArray(obj.objects)) {
            var found = recurse(obj.objects);
            if (found) return found;
          }
        }
        return null;
      }
      return recurse(jsonData.objects);
    }


    function procurarElementoPorId(canvas, identificador) {
      function recurse(obj) {
        if (obj.id === identificador) return obj;
        // se for um grupo, percorre seus filhos
        if (obj._objects && Array.isArray(obj._objects)) {
          for (var i = 0; i < obj._objects.length; i++) {
            var found = recurse(obj._objects[i]);
            if (found) return found;
          }
        }
        return null;
      }
      // varre cada objeto raiz do canvas
      var rootObjs = canvas.getObjects();
      for (var i = 0; i < rootObjs.length; i++) {
        var f = recurse(rootObjs[i]);
        if (f) return f;
      }
      return null;
    }
    

  /**
   * @function generateRandomId
   * @description Gera um ID alfanumérico aleatório de um determinado comprimento.
   * @param {number} length - O comprimento do ID a ser gerado.
   * @returns {string} O ID aleatório gerado.
   */
  function generateRandomId(length) {
    var result = "";
    var characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  /**
   * @function getUniqueId
   * @description Gera um ID único para um objeto no canvas.
   * @param {fabric.Canvas} canvas - A instância do canvas do Fabric.js.
   * @returns {string} O ID único gerado.
   */
  function getUniqueId(canvas) {
    var id;
    do {
      id = generateRandomId(8);
    } while (canvas.getObjects().some((obj) => obj.id === id));
    return id;
  }
    

    /**
     * @function changeColor
     * @description Substitui cores sólidas ou parciais de gradiente.
     * Se for um objeto com gradiente em `fill`, altera apenas o colorStop[0] (Primária)
     * e/ou o colorStop[1] (Secundária), dependendo de `changeToColor` e `changeToColor2`.
     * Se não for gradiente, faz exatamente como antes.
     *
     * @param {fabric.Object} element         - O objeto do Fabric.js a ser modificado.
     * @param {string} primaryColor           - Cor primária (ex: "#RRGGBB").
     * @param {string} secondaryColor         - Cor secundária (ex: "#RRGGBB").
     * @returns {Promise<void>}
     */
    function changeColor(element, primaryColor, secondaryColor) {
      return new Promise((resolve, reject) => {
        try {
          // Flags de troca
          const wantsPrimary   = element.changeToColor === "Primária";
          const wantsSecondary = element.changeToColor === "Secundária";
          const hasSecondFlag  = typeof element.changeToColor2 === "string";

          // Se não houver nenhuma indicação de troca, sai
          if (!wantsPrimary && !wantsSecondary && !hasSecondFlag) {
            resolve();
            return;
          }

          // 1) Verifica se o fill é um gradiente linear
          const fill = element.fill;
          const isGradientFill = fill && typeof fill === "object" && fill.type === "linear";

          if (isGradientFill) {
            const stops = fill.colorStops || [];

            // Troca o primeiro stop se changeToColor for “Primária”
            if (wantsPrimary && stops.length > 0) {
              stops[0].color = primaryColor;
            }
            // Troca o segundo stop se changeToColor2 for “Secundária”
            if (element.changeToColor2 === "Secundária" && stops.length > 1) {
              stops[1].color = secondaryColor;
            }
            // Caso queira trocar o segundo stop pela cor primária:
            if (element.changeToColor2 === "Primária" && stops.length > 1) {
              stops[1].color = primaryColor;
            }

            // Reatribui o fill para que o Fabric.js redesenhe o gradiente
            element.set("fill", fill);
            resolve();
            return;
          }

          // 2) Se não for gradiente, troca como antes
          if (wantsPrimary) {
            if (element instanceof fabric.Line) {
              element.set("stroke", primaryColor);
            } else {
              element.set("fill", primaryColor);
            }
            resolve();
            return;
          }

          if (wantsSecondary) {
            if (element instanceof fabric.Line) {
              element.set("stroke", secondaryColor);
            } else {
              element.set("fill", secondaryColor);
            }
            resolve();
            return;
          }

          // 3) Se só tiver changeToColor2, trata aqui
          if (element.changeToColor2 === "Primária") {
            if (element instanceof fabric.Line) {
              element.set("stroke", primaryColor);
            } else {
              element.set("fill", primaryColor);
            }
          } else if (element.changeToColor2 === "Secundária") {
            if (element instanceof fabric.Line) {
              element.set("stroke", secondaryColor);
            } else {
              element.set("fill", secondaryColor);
            }
          }

          resolve();
        } catch (err) {
          reject(err);
        }
      });
    }
    


  /**
   * @function loadCanvasFromJSON
   * @description Carrega o JSON de dados no canvas, aplicando redimensionamento e configurações de selecionabilidade.
   * @param {fabric.Canvas} canvas - A instância do canvas do Fabric.js.
   * @param {object} jsonData - O objeto JSON que representa o canvas.
   * @returns {Promise<void>} Uma promessa que resolve quando o canvas é carregado e processado.
   */
  function loadCanvasFromJSON(canvas, jsonData) {
    return new Promise(function (resolve) {
    
        if (jsonData && Array.isArray(jsonData.objects)) {
          flattenGroups(jsonData);
        }
        

      canvas.loadFromJSON(jsonData, function () {
        // Encontra o retângulo de fundo (primeiro objeto no JSON)
        var bgRect = jsonData.objects[0];
        if (!bgRect || bgRect.type !== "rect") {
          console.error("bgRect não encontrado ou não é um retângulo");
          resolve(); // Resolve mesmo em caso de erro para não travar a cadeia de promessas
          return;
        }

        // Calcula as dimensões originais do retângulo de fundo
        var originalWidth = bgRect.width * bgRect.scaleX;
        var originalHeight = bgRect.height * bgRect.scaleY;

        // Calcula a escala necessária para ajustar ao tamanho do canvas
        var scaleX = canvas.width / originalWidth;
        var scaleY = canvas.height / originalHeight;

        // Aplica o redimensionamento em todos os objetos do canvas
        canvas.getObjects().forEach(function (obj) {
          obj.set({
            scaleX: obj.scaleX * scaleX,
            scaleY: obj.scaleY * scaleY,
            left: obj.left * scaleX,
            top: obj.top * scaleY,
          });
           
            
          // Atualiza as coordenadas do objeto após o redimensionamento
          obj.setCoords();

          // Aplica o comportamento de bloqueio com base em clientSelectable
          if (typeof obj.clientSelectable === "boolean" || obj.name === "bgRect"  || obj.name === properties.name) {
              
                var bloquear = obj.clientSelectable === false || obj.name === "bgRect" || obj.name === properties.name;

                  obj.selectable = !bloquear;

                  if (bloquear) {
                  obj.hasControls = false;
                  obj.hasBorders = false;
                  obj.hasRotatingPoint = false;
                  obj.lockMovementX = true;
                  obj.lockMovementY = true;
                  obj.lockScalingX = true;
                  obj.lockScalingY = true;
                  obj.lockRotation = true;
                  obj.evented = false;
                  obj.hoverCursor = "default";

                  // Remover da seleção ativa caso esteja
                  if (obj.canvas && obj.canvas.getActiveObject() === obj) {
                    obj.canvas.discardActiveObject();
                    obj.canvas.requestRenderAll();
                  }
                } else {
                  // Reativa comportamentos caso permitido
                  obj.hasControls = true;
                  obj.hasBorders = true;
                  obj.lockMovementX = false;
                  obj.lockMovementY = false;
                  obj.lockScalingX = false;
                  obj.lockScalingY = false;
                  obj.lockRotation = false;
                  obj.evented = true;
                }
          }
            
        });

        // Força a renderização do canvas
        canvas.renderAll();

        resolve();
      });
    });
  }

  /**
   * @function loadImage
   * @description Carrega uma imagem a partir de uma URL e retorna uma promessa com o elemento Image.
   * @param {string} src - A URL da imagem a ser carregada.
   * @returns {Promise<HTMLImageElement>} Uma promessa que resolve com o elemento HTMLImageElement.
   */
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = "anonymous"; // Necessário para evitar problemas de CORS
      img.onload = function () {
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * @function processImage
   * @description Processa e redimensiona uma imagem para caber em um espaço definido no canvas.
   * @param {fabric.Image} imageToEdit - O objeto fabric.Image a ser modificado.
   * @param {HTMLImageElement} imgElement - O elemento HTML Image carregado.
   * @param {number} originalWidth - A largura original do espaço de destino.
   * @param {number} originalHeight - A altura original do espaço de destino.
   * @param {number} originalTop - A posição superior original do espaço de destino.
   * @param {number} originalLeft - A posição esquerda original do espaço de destino.
   * @param {string} name - O nome do objeto (usado para lógica específica da logo).
   */
  function processImage(
    imageToEdit,
    imgElement,
    originalWidth,
    originalHeight,
    originalTop,
    originalLeft,
    name
  ) {
    var newImg = new fabric.Image(imgElement);

    // Lógica de redimensionamento específica para "logo" ou outras imagens
    if (name === "logo" && (newImg.scaleX < 0.1 || newImg.scaleY < 0.1)) {
      const absoluteWidth = newImg.scaleX * newImg.width;
      const absoluteHeigth = newImg.scaleY * newImg.height;
      const newscaleX = absoluteWidth / 300;
      const newscaleY = absoluteHeigth / 300;
      newImg.set({
        width: 300,
        height: 300,
        scaleX: newscaleX,
        scaleY: newscaleY,
      });
    } else {
      // Para todas as outras imagens, ou se a "logo" já for menor, usa o escalonamento padrão
      var largestSideOriginal = Math.max(originalWidth, originalHeight);
      var largestSideNew = Math.max(newImg.width, newImg.height);
      var scale = largestSideOriginal / largestSideNew;
      newImg.scaleX = scale;
      newImg.scaleY = scale;
    }

    // Aplica o escalonamento e centraliza a imagem no espaço original
    var newWidth = newImg.width * newImg.scaleX;
    var newHeight = newImg.height * newImg.scaleY;
    var centeredLeft = originalLeft + (originalWidth - newWidth) / 2;
    var centeredTop = originalTop + (originalHeight - newHeight) / 2;

    // Atualiza o objeto fabric.Image existente com a nova imagem e suas propriedades
    imageToEdit.setElement(newImg._element);
    imageToEdit.set({
      scaleX: newImg.scaleX,
      scaleY: newImg.scaleY,
      width: newImg.width,
      height: newImg.height,
      top: centeredTop,
      left: centeredLeft,
    });
  }

  /**
   * @function inicializarCanvas
   * @description Função principal para inicializar e processar o canvas do Fabric.js.
   * Gerencia o carregamento de dados, aplicação de cores, substituição de imagens e textos.
   */
  function inicializarCanvas() {
    // Verifica se o canvas está disponível no objeto global window.vpCanvas
    if (window.vpCanvas && window.vpCanvas[properties.canvasId]) {
      instance.publishState("status", "processing"); // Publica o status de processamento

      const canvasId = properties.canvasId;
      const canvas = window.vpCanvas[canvasId]; // Obtém a instância do canvas
      const jsonData = JSON.parse(properties.jsonData); // Converte o JSON de dados
      const names = [
        properties.textoCTAName,
        properties.shapeCTAName,
        properties.logoName,
        properties.shapeLogoName,
        "editname",
        "editwhats",
        "editfotoperfil",
        "editendereco",
        "editfotofundo",
        "editfotoproduto",
      ];
      var   idNames      = []; // Array para armazenar os IDs dos elementos
      const primaryColor = properties.primaryColor;
      const secondaryColor = properties.secondaryColor;
      const newImageUrl  = "https:" + properties.newImage;
      let   imageToEdit; // Variável para a imagem a ser editada
      const waterMarkSrc = "https:" + properties.waterMarkSrc;
      const waterMarkMax = properties.waterMarkMax;
      const isFreePlan   = properties.isFreePlan;
      const editname     = properties.editname || "Seu Nome Aqui";
      const editwhats    = properties.editwhats || "(00) 0 0000-0000";
      const editendereco = properties.editendereco || "Seu Endereço Aqui";
      const editfotoperfil =
        "https:" +
        (properties.editfotoperfil ||
          "//s3.amazonaws.com/appforest_uf/f1674857905873x207865835916353200/blank-profile-picture-973460_1280.webp");

      // Verifica se o canvas foi encontrado
      if (!canvas) {
        console.error("Canvas não encontrado com o ID:", canvasId);
        return;
      }

      /**
       * @function processCanvas
       * @description Orquestra todas as operações de processamento do canvas em uma sequência de promessas.
       */
        function processCanvas() {
          loadCanvasFromJSON(canvas, jsonData)
            .then(function () {
              
              if (properties.lockImgNotDynamic === true) {
                  // percorre todos os objetos do canvas
                  canvas.getObjects().forEach(function(obj) {
                    // se for imagem e não for uma das dinâmicas, bloqueia seleção
                    if (obj.type === 'image' 
                        && ['editfotoperfil','editfotofundo','editfotoproduto'].indexOf(obj.name) === -1) {
                      obj.selectable = false
                      obj.hasControls = false
                      obj.hasBorders = false
                      obj.evented = false
                    }
                  })
                }

              
              // 2. Coleta os IDs dos elementos
              names.forEach(function (name) {
                var element = procurarElemento(jsonData, name);
                idNames.push(element ? element.id : null);
              });

              instance.publishState("textCTAID",     idNames[0]);
              instance.publishState("shapeCTAID",    idNames[1]);
              instance.publishState("logoID",        idNames[2]);
              instance.publishState("shapeLogoID",   idNames[3]);
              instance.publishState("editNameID",    idNames[4]);
              instance.publishState("editWhatsID",   idNames[5]);
              instance.publishState("editFotoPerfilID", idNames[6]);
              instance.publishState("editEnderecoID",   idNames[7]);
              instance.publishState("editFotoFundoID",  idNames[8]);
              instance.publishState("editFotoProdutoID",idNames[9]);

              // 3. Aplica cores (incluindo gradientes) a todos os objetos
              const objects = canvas.getObjects();
              const colorChangePromises = objects.map(element =>
                changeColor(element, primaryColor, secondaryColor)
              );

              return Promise.all(colorChangePromises);
            })
            .then(function () {
              // Após todas as promessas de troca de cor estarem concluídas,
              // marcamos cada objeto como "sujo" e solicitamos redesenho
              canvas.getObjects().forEach(obj => {
                obj.dirty = true;
                // ou, se preferir garantir recalcular bounds:
                // obj.setCoords();
              });
              canvas.requestRenderAll();

              // 4. Carrega a nova imagem (logo)
              return loadImage(newImageUrl);
            })
            .then(function (imgElement) {
              // 5. Processa a imagem da logo (mesma lógica de antes)…
              return new Promise(function (resolve) {
                if (idNames[2]) {
                  imageToEdit = procurarElementoPorId(canvas, idNames[2]);
                }

                if (!imageToEdit || imageToEdit.type !== "image") {
                  imageToEdit = procurarElementoPorId(canvas, properties.logoName); //buscar por nome dentro de grupos
                  resolve();
                  return;
                }

                var originalWidth  = imageToEdit.width  * imageToEdit.scaleX;
                var originalHeight = imageToEdit.height * imageToEdit.scaleY;
                var originalTop    = imageToEdit.top;
                var originalLeft   = imageToEdit.left;
                var name           = imageToEdit.name;

                if (imgElement.complete) {
                  processImage(
                    imageToEdit,
                    imgElement,
                    originalWidth,
                    originalHeight,
                    originalTop,
                    originalLeft,
                    name
                  );
                  resolve();
                } else {
                  imgElement.onload = function () {
                    processImage(
                      imageToEdit,
                      imgElement,
                      originalWidth,
                      originalHeight,
                      originalTop,
                      originalLeft,
                      name
                    );
                    resolve();
                  };
                }
              });
            })

            // 6. Determina a cor de fundo da imagem e aplica a um elemento de forma (fundo da logo)
            .then(function () {
              return new Promise(function (resolve) {
                if (!idNames[3]) {
                  resolve()
                  return
                }
                try {
                  // Função para converter rgb→hex
                  function rgbToHex(r, g, b) {
                    var toHex = function(c) {
                      var hex = c.toString(16)
                      return hex.length == 1 ? "0" + hex : hex
                    }
                    return "#" + toHex(r) + toHex(g) + toHex(b)
                  }
                  var image = new Image()
                  image.crossOrigin = "anonymous"
                  image.src = newImageUrl
                  image.onload = function () {
                    try {
                      var provCanvas = document.createElement("canvas")
                      provCanvas.width = image.width
                      provCanvas.height = image.height
                      var context = provCanvas.getContext("2d")
                      context.drawImage(image, 0, 0)
                      var pixelData = context.getImageData(0, 0, 1, 1).data

                      var corDeFundo
                      // Verifica se o pixel é transparente (alpha < 255)
                      if (pixelData[3] < 255) {
                        // Se transparente, usa branco como cor de fundo
                        corDeFundo = "#ffffff"
                      } else {
                        // Se opaco, usa a cor do pixel
                        corDeFundo = rgbToHex(pixelData[0], pixelData[1], pixelData[2])
                      }

                      var elementoParaMudarCor = procurarElementoPorId(canvas, idNames[3])
                      
                      if (!elementoParaMudarCor) {
                        elementoParaMudarCor = procurarElementoPorId(canvas, properties.shapeLogoName) // tenta encontrar pelo name dentro de grupos
                      }
                        
                      if (elementoParaMudarCor && elementoParaMudarCor.set && elementoParaMudarCor.fill !== undefined) {
                        elementoParaMudarCor.set("fill", corDeFundo)
                        canvas.requestRenderAll()
                      }
                      resolve()
                    } catch (e) {
                      resolve()
                    }
                  }
                  image.onerror = function () { resolve() }
                } catch (e) {
                  resolve()
                }
              })
            })

            
            // 6.1 Agrupa logo + shapeLogo em um grupo chamado "logoagrupado" mantendo a ordem Z
            .then(function() {
              // Tenta achar pelo ID; se não encontrar, busca pelo name
              var logoObj       = procurarElementoPorId(canvas, idNames[2])       || procurarElementoPorId(canvas, properties.logoName)
              var shapeLogoObj  = procurarElementoPorId(canvas, idNames[3])       || procurarElementoPorId(canvas, properties.shapeLogoName)

              // Se existir shapeLogo, agrupa os dois juntos
              if (logoObj && shapeLogoObj) {
                // Captura a posição mais baixa (mais atrás) dos dois objetos na ordem Z
                var logoIndex = canvas.getObjects().indexOf(logoObj)
                var shapeLogoIndex = canvas.getObjects().indexOf(shapeLogoObj)
                var targetIndex = Math.min(logoIndex, shapeLogoIndex)

                // Remove os objetos originais
                canvas.remove(shapeLogoObj, logoObj)

                // Cria o grupo
                var group = new fabric.Group([ shapeLogoObj, logoObj ], {
                  name: 'logo_agrupado',
                  id:   getUniqueId(canvas),
                })

                // Insere o grupo na posição correta para manter a ordem Z
                canvas.insertAt(group, targetIndex)
                canvas.requestRenderAll()
              }
              // Se NÃO existir shapeLogo, agrupa apenas a logo
              else if (logoObj) {
                // Captura a posição original da logo na ordem Z
                var logoIndex = canvas.getObjects().indexOf(logoObj)

                // Remove o objeto original
                canvas.remove(logoObj)

                // Cria o grupo só com a logo
                var soloGroup = new fabric.Group([ logoObj ], {
                  name: 'logo_agrupado',
                  id:   getUniqueId(canvas),
                })

                // Insere o grupo na posição original da logo
                canvas.insertAt(soloGroup, logoIndex)
                canvas.requestRenderAll()
              }
            })
            
          .then(function () {
            // 7. Adiciona marca d'água se for plano gratuito
            if (!isFreePlan) {
              return Promise.resolve(); // Pula esta etapa se não for plano gratuito
            }
            return loadImage(waterMarkSrc);
          })
          .then(function (waterMarkImgElement) {
            if (!isFreePlan) {
              return; // Retorna se a marca d'água não for necessária
            }

            // Calcula a escala da marca d'água
            var scale = Math.min(
              waterMarkMax / waterMarkImgElement.width,
              waterMarkMax / waterMarkImgElement.height
            );

            // Cria e adiciona a marca d'água ao canvas
            var fabricImg = new fabric.Image(waterMarkImgElement, {
              left: properties.left,
              top: properties.top,
              angle: properties.angle,
              scaleX: scale,
              scaleY: scale,
              selectable: false,
              clientSelectable: false,
              hasControls: false,
              hasBorders: false,
              hasRotatingPoint: false,
              lockMovementX: true,
              lockMovementY: true,
              lockScalingX: true,
              lockScalingY: true,
              lockRotation: true,
              evented: false,
              hoverCursor: "default",
              excludeFromHistory: true,
              layerName: "Marca D'água",
              clientSelectable: false,
              id: getUniqueId(canvas), // Gera um ID único para a marca d'água
              opacity: 0.6,
            });

            if (properties.name) {
              fabricImg.set({ name: properties.name });
            }

            canvas.add(fabricImg);

            //if (typeof canvas.vapt.resetHistoryUndo === 'function') {
            //    canvas.vapt.resetHistoryUndo();
            //} 

          })
          .then(function () {
            // 8. Atualiza o texto do nome
            return new Promise(function (resolve) {
              var elementWithName = canvas
                .getObjects()
                .find((obj) => obj.name === "editname");
              if (elementWithName && (elementWithName.type === "i-text" || elementWithName.type === "textbox")) {
                changeText(elementWithName, editname);
              }
              resolve();
            });
          })
          .then(function () {
            // 9. Atualiza o texto do WhatsApp
            return new Promise(function (resolve) {
              var elementWithWhats = canvas
                .getObjects()
                .find((obj) => obj.name === "editwhats");
              if (elementWithWhats && (elementWithWhats.type === "i-text" || elementWithWhats.type === "textbox")) {
                changeText(elementWithWhats, editwhats);
              }
              resolve();
            });
          })
          .then(function () {
            // 10. Atualiza a imagem de perfil
            return new Promise(function (resolve) {
              loadImage(editfotoperfil) // Carrega a imagem de perfil
                .then(function (imgElement) {
                  var elementWithProfileImage = canvas
                    .getObjects()
                    .find((obj) => obj.name === "editfotoperfil");

                  if (
                    elementWithProfileImage &&
                    elementWithProfileImage.type === "image"
                  ) {
                    // Salva as dimensões e posições originais da imagem de perfil
                    var originalWidth =
                      elementWithProfileImage.width *
                      elementWithProfileImage.scaleX;
                    var originalHeight =
                      elementWithProfileImage.height *
                      elementWithProfileImage.scaleY;
                    var originalTop = elementWithProfileImage.top;
                    var originalLeft = elementWithProfileImage.left;
                    var name = elementWithProfileImage.name;

                    // Processa a imagem de perfil
                    processImage(
                      elementWithProfileImage,
                      imgElement,
                      originalWidth,
                      originalHeight,
                      originalTop,
                      originalLeft,
                      name
                    );
                    resolve();
                  } else {
                    resolve(); // Resolve se não houver imagem de perfil para editar
                  }
                })
                .catch(function (error) {
                  console.error("Erro ao carregar a imagem de perfil:", error);
                  resolve(); // Resolve a promessa mesmo em caso de erro
                });
            });
          })
          .then(function () {
            // 11. Atualiza o texto do endereço
            return new Promise(function (resolve) {
              var elementWithEndereco = canvas
                .getObjects()
                .find((obj) => obj.name === "editendereco");
              if (elementWithEndereco && (elementWithEndereco.type === "i-text" || elementWithEndereco.type === "textbox")) {
                changeText(elementWithEndereco, editendereco);
              }
              resolve();
            });
          })
          .then(function () {
            // 12. Finaliza o processamento do canvas
            return new Promise((resolve) => {
              // Desativa renderização automática temporariamente
              canvas.renderOnAddRemove = false;
              canvas.skipTargetFind = true;
              
              // Força uma atualização do objeto com clipping mask
              var elementWithClip = canvas
                .getObjects()
                .find((obj) => obj.clipPath);
                
              if (elementWithClip) {
                elementWithClip.dirty = true;
                if (elementWithClip.clipPath) {
                  elementWithClip.clipPath.dirty = true;
                }
              }


              // Usa o sistema de eventos do Fabric para garantir renderização completa
              canvas.once('after:render', function() {
                    // Restaura configurações originais
                    canvas.renderOnAddRemove = true;
                    canvas.skipTargetFind = false;

                    // Garante que tudo foi processado antes de finalizar
                    fabric.util.requestAnimFrame(function() {
                          canvas.requestRenderAll();

                          // RESETA O HISTÓRICO DO DESFAZER
                          if (typeof canvas.vapt.resetHistoryUndo === 'function') {
                             canvas.vapt.resetHistoryUndo();
                          } 

                          instance.triggerEvent("transformed");
                          instance.publishState("status", "finished");
                          resolve();
                    });
              });

                
              // Inicia o processo de renderização
              canvas.renderAll();
            });
          })
          .catch(function (error) {
            console.error("Erro durante o processamento do canvas:", error);
            instance.publishState("status", "finished");
          });
      }

      processCanvas();
    } else {
      setTimeout(inicializarCanvas, 1000);
    }
  }

    
    debounceIniciarCanvas();

    
}