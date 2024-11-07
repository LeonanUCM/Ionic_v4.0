import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import * as tf from '@tensorflow/tfjs';

class ArrayUtils {
  // Method to slice a 2D array in TypeScript
  static slice(array: number[][], startRow: number, endRow: number, startCol: number, endCol: number): number[][] {
    const result: number[][] = [];
    for (let i = startRow; i < endRow; i++) {
      result.push(array[i].slice(startCol, endCol));
    }
    return result;
  }

  // Method to print a 2D array
  static print2DArray(array: number[][]): void {
    array.forEach(row => {
      console.log(row);
    });
  }

  // Method to get the shape of a 2D array
  static shape(array: number[][]): [number, number] {
    const rows = array.length;
    const cols = array[0].length;
    return [rows, cols];
  }
}

@Component({
  selector: 'app-fruit-count',
  templateUrl: './fruit-count.page.html',
  styleUrls: ['./fruit-count.page.scss'],
})

export class FruitCountPage implements OnInit, AfterViewInit {
  private logLevel: number = 2; // Variable to control log level: 1 (most significant) to 3 (less significant)
  private model: tf.GraphModel | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private originalImage: HTMLImageElement | null = null;
  private ellipses: any[] = [];
  private confidence_threshold: number = 5;
  private thresholdValue: number = 5;    
  private predictionsData: any[] = [];
  private modelFilename: string = '';
  private fruitType: string = '';
  private fruitSampleFilename: string = '';
  private baseResolution: number = 640;
  private _confidenceSlider: number = 5;  
  private _fruitName: string = '';
  private _badgeCount: number = 0;


  // Getter y Setter para _confidenceSlider
  public get confidenceSlider(): number {
    return this._confidenceSlider;
  }

  public set confidenceSlider(value: number) {
    this._confidenceSlider = value;
  }

  // Getter y Setter para _fruitName
  public get fruitName(): string {
    return this._fruitName;
  }

  public set fruitName(value: string) {
    this._fruitName = value;
  }

  // Getter y Setter para _badgeCount
  public get badgeCount(): number {
    return this._badgeCount;
  }

  public set badgeCount(value: number) {
    this._badgeCount = value;
  }

  constructor(private route: ActivatedRoute, private navCtrl: NavController) {}

  // Log function to control the level of logging
  log(message: string, level: number = 3) {
    if (level <= this.logLevel) {
      console.log(`[Level ${level}]: ${message}`);
    }
  }
  
  goBack() {
    this.navCtrl.back(); // Regresa a la página anterior
  }
  
  async ngOnInit() {
    this.log('ngOnInit called.', 2);

    this.route.queryParams.subscribe(params => {
      this.fruitType = params['fruit_type'];  // Captura el parámetro fruit_type
      this.log(`Fruit type: ${this.fruitType}`, 1);
    });    

    if (this.fruitType == 'manzana-verde') {
      this.modelFilename = './assets/models/apple-green-model_js/model.json';
      this.fruitSampleFilename = './assets/test-dataset/apple-green-test.jpg';
      this.fruitName = 'Manzana Verde';
    } else if (this.fruitType == 'citrus-naranja') {
      this.modelFilename = './assets/models/citrus-orange-model_js/model.json';
      this.fruitSampleFilename = './assets/test-dataset/citrus-orange-test.jpg';
      this.fruitName = 'Citrus Naranja';
    } else if (this.fruitType == 'melocoton-amarillo') {
      this.modelFilename = './assets/models/peach-yellow-model_js/model.json';
      this.fruitSampleFilename = './assets/test-dataset/peach-yellow-test.jpg';
      this.fruitName = 'Melocoton Amarillo';
    } else if (this.fruitType == 'melocoton-rojo') {
      this.modelFilename = './assets/models/peach-red-model_js/model.json';
      this.fruitSampleFilename = './assets/test-dataset/peach-red-test.jpg';
      this.fruitName = 'Melocoton Rojo';
    } else {  
      this.navCtrl.back();
    }

    await this.initializeEventListeners();
    this.handleImageUpload(this.fruitSampleFilename);
  }

  ngAfterViewInit() {
  }

  async loadModel(reload = false) {
    console.log(`TensorFlow.js version: ${tf.version.tfjs}`);

    if (this.model !== null && !reload) {
      this.log('Model already loaded. Skipping re-load.', 1);
      return;
    }

    this.showLoading(true, 'Loading model...');
    try {
      this.model = await tf.loadGraphModel(this.modelFilename);
      this.log('Model loaded successfully.', 1);
    } catch (error) {
      console.error('Error loading the model:', error);
      alert('Error loading the model. Check the console for more details.');
    } finally {
      this.showLoading(false, '');
    }
  }

  async initializeEventListeners() {
    this.log('Initializing event listeners.', 3);
    
    document.getElementById('imageUpload')?.addEventListener('change', this.handleImageUpload.bind(this));
    document.getElementById('cameraUpload')?.addEventListener('change', this.handleImageUpload.bind(this));
    document.getElementById('confidenceSlider')?.addEventListener('input', this.handleSliderChange.bind(this));

    // Listen for window resize to reapply the 100% width and auto height behavior
    window.addEventListener('resize', () => {
      this.canvas!.style.width = `100%`;
      // Use requestAnimationFrame to ensure layout reflow before adjusting dimensions
      requestAnimationFrame(() => {
        this.adjustCanvasDimensions(this.originalImage!);
        if (this.ctx) {
          this.drawEllipses(this.ctx, this.ellipses, this.confidence_threshold);
        }
      });
    });

    this.confidence_threshold = this.calcConfidenceThreshold(this.confidence_threshold);
    this.log(`Initial confidence threshold: ${this.confidence_threshold}`, 2);
    
    this.canvas = document.getElementById('resultCanvas') as HTMLCanvasElement;

    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) {
        console.error('Failed to get canvas context during initialization.');
      }
    }
    this.drawImageRounded(this.canvas, this.fruitSampleFilename);
    await this.loadModel(true);
  }

  showLoading(show: boolean, message: string) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const statusMessage = document.getElementById('statusMessage');
    if (loadingOverlay && statusMessage) {
      if (show) {
        this.log(`Showing loading overlay with message: ${message}`, 2);
        loadingOverlay.classList.remove('hidden');
        statusMessage.textContent = message;
      } else {
        this.log('Hiding loading overlay.', 2);
        loadingOverlay.classList.add('hidden');
      }
    }
  }


  async handleImageUpload(input: any) {
    this.log('Image upload triggered.', 2);
    this.showLoading(true, 'Loading image...');

    let file: File;

    // Verificar si la entrada es un evento o un string
    if (typeof input === 'string') {
      this.log('Received filename.', 2);
        
      try {
          // Utilizar fetch para obtener el archivo desde la URL
          const response = await fetch(input);
          
          if (!response.ok) {
              throw new Error(`Failed to load image from URL: ${input}`);
          }

          const blob = await response.blob();
          file = new File([blob], input.split('/').pop()!, { type: blob.type });
      } catch (error) {
          console.error('Error loading image:', error);
          this.showLoading(false, '');
          return;
      }
    } else if (input && input.target && input.target.files && input.target.files[0]) {
        this.log('Received event.', 2);
        file = input.target.files[0];
        this.log(`Selected image file: ${file.name}`, 2);
    } else {
        throw new Error('Invalid input: Expected a file event or a filename.');
    }

    try {
        // Clear previous predictions and count
        this.predictionsData.length = 0;

        this.canvas = document.getElementById('resultCanvas') as HTMLCanvasElement;
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            if (!this.ctx) {
                throw new Error('Failed to get canvas context.');
            }
        }

        const img = new Image();
        img.src = URL.createObjectURL(file);

        img.onload = async () => {
            this.adjustCanvasDimensions(img);

            if (this.ctx) {
              console.log(`Saving original image.`); // DEBUG LOG
              this.originalImage = img;
            }

            const inputTensor = this.imageToTensor(img);
            this.log(`Input tensor shape: ${inputTensor.shape}`, 1);
            this.showLoading(true, 'Detecting objects...');

            let final_boxes: tf.Tensor | undefined, final_scores: tf.Tensor | undefined;
            try {
                const result = await this.predict(inputTensor);
                if (!result || !result.final_boxes || !result.final_scores) {
                    throw new Error('No results received from prediction.');
                }

                final_boxes = result.final_boxes;
                final_scores = result.final_scores;

            } catch (error) {
                console.error('Error during prediction:', error);
            } finally {
                tf.dispose([inputTensor]);
            }

            if (final_boxes && final_scores && this.ctx) {
                console.log(`Comenzando a dibujar ${this.ellipses.length} elipses`); // DEBUG LOG
                this.ellipses = await this.tensorToEllipses(final_boxes, final_scores);
                await this.drawEllipses(this.ctx, this.ellipses, this.confidence_threshold);
            }

            this.showLoading(false, '');
        };
    } catch (error) {
        console.error('Error loading the image:', error);
    } finally {
        this.showLoading(false, '');
    }
}
  

  handleSliderChange(event: any) {
    this.canvas = document.getElementById('resultCanvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) {
        console.error('Failed to get canvas context.');
        return;
      }
    }

    this.confidence_threshold = this.calcConfidenceThreshold(parseInt(event.target.value));
    this.log(`Confidence threshold updated: ${this.confidence_threshold}`, 1);

    if (this.ctx) {
      this.drawEllipses(this.ctx, this.ellipses, this.confidence_threshold);
    }
  }

  calcConfidenceThreshold(newThreshold: number): number {
    return Math.round(103 - newThreshold * 10) / 100;
  }

  imageToTensor(img: HTMLImageElement): tf.Tensor {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.baseResolution;
    tempCanvas.height = this.baseResolution;
    const ctxTemp = tempCanvas.getContext('2d');
    if (!ctxTemp) {
      throw new Error('Failed to get temporary canvas context.');
    }
    ctxTemp.drawImage(img, 0, 0, this.baseResolution, this.baseResolution);
    const imageData = ctxTemp.getImageData(0, 0, this.baseResolution, this.baseResolution);
  
    // Convert the image to a tensor
    let return_tensor = tf.browser.fromPixels(imageData).toFloat().div(255.0);
  
    // // Reverse the channels from RGB to BGR
    // const [r, g, b] = tf.split(return_tensor, 3, 2); // Split along the color channel axis
    // return_tensor = tf.concat([b, g, r], 2);         // Concatenate in the order BGR
  
    // Add an extra batch dimension
    return_tensor = return_tensor.expandDims(0); 
  
    this.log(`Image shape: ${return_tensor.shape}`, 2);
    return return_tensor;
  }
  

  async applyNMS(
    boxes: tf.Tensor2D, // boxes of shape [N, 4]
    scores: tf.Tensor1D, // scores of shape [N]
    iouThreshold: number = 0.5,
    maxOutputSize: number = 300
  ): Promise<{ finalBoxes: tf.Tensor2D; finalScores: tf.Tensor1D }> {
    // Extract x_center, y_center, width, height
    const xCenters = boxes.slice([0, 0], [-1, 1]); // Shape: [N, 1]
    const yCenters = boxes.slice([0, 1], [-1, 1]); // Shape: [N, 1]
    const widths = boxes.slice([0, 2], [-1, 1]);   // Shape: [N, 1]
    const heights = boxes.slice([0, 3], [-1, 1]);  // Shape: [N, 1]
  
    // Calculate half widths and half heights
    const halfWidths = widths.mul(0.5);
    const halfHeights = heights.mul(0.5);
  
    // Compute xmin, ymin, xmax, ymax
    const xmin = xCenters.sub(halfWidths);
    const ymin = yCenters.sub(halfHeights);
    const xmax = xCenters.add(halfWidths);
    const ymax = yCenters.add(halfHeights);
  
    // Stack the boxes in [ymin, xmin, ymax, xmax] format
    const convertedBoxes = tf.concat([ymin, xmin, ymax, xmax], 1) as tf.Tensor2D; // Shape: [N, 4]
  
    // Apply Non-Max Suppression
    const nmsIndices = await tf.image.nonMaxSuppressionAsync(
      convertedBoxes,
      scores,
      maxOutputSize,
      iouThreshold,
      0.0 // scoreThreshold is 0.0 because we've already filtered low scores
    );
  
    // Gather the filtered boxes and scores
    const finalBoxes = boxes.gather(nmsIndices) as tf.Tensor2D;
    const finalScores = scores.gather(nmsIndices) as tf.Tensor1D;
  
    return { finalBoxes, finalScores };
  }
  

  adjustCanvasDimensions(img: HTMLImageElement) {
    const imageWidth = img.naturalWidth;
    const imageHeight = img.naturalHeight;
    const ratio = imageWidth / imageHeight;
  
    // Tamaño interno (resolución completa de la imagen)
    this.canvas!.width = imageWidth;
    this.canvas!.height = imageHeight;
  
    // Tamaño a ser exibido (dados por CSS width=100% height=auto)
    if (ratio > 1) {
      this.canvas!.style.width = `${this.canvas!.offsetWidth}px`;
      this.canvas!.style.height = `${this.canvas!.offsetWidth / ratio}px`;
    } else {
      this.canvas!.style.width = `${this.canvas!.offsetHeight * ratio}px`;
      this.canvas!.style.height = `${this.canvas!.offsetHeight}px`;
    }
  
    // Restablecer cualquier escalado previo del contexto
    this.ctx!.setTransform(1, 0, 0, 1, 0, 0);
  
    // Escalar el contexto para que coincida con el tamaño visual del canvas
    this.ctx!.scale(1, 1);
  
    // Dibujar la imagen original dentro del canvas escalada al tamaño interno completo
    this.ctx!.drawImage(img, 0, 0, imageWidth, imageHeight);
  
    this.log(`Adjusted canvas dimensions: ratio=${ratio} width=${imageWidth}/${this.canvas!.style.width}, height=${imageHeight}/${this.canvas!.style.height}`, 2);
  }
  
  

  async predict(inputTensor: tf.Tensor) {
    if (!this.model) {
      console.error('Model is not loaded.');
      return;
    }

    this.log(`Input tensor shape: ${inputTensor.shape}`, 2);
    let outputs: any;
    try {
      outputs = this.model.execute(inputTensor);
    } catch (error) {
      console.error('Error during model execution:', error);
      return;
    }


    // Step 1: Remove dimension 1
    let outputs_squeezed = outputs.squeeze([0]); // Shape: [5, 8400]
    console.log(`After squeezing, shape: [${outputs_squeezed.shape}]`);
    if ( this.logLevel >= 3 ) {
      console.log('First 10 elements after squeezing (along each of the 5 properties):');
      outputs_squeezed.slice([0, 0], [5, 10]).print();
    }

    // Step 2: Transpose to get [8400, 5]
    let outputs_transposed = outputs_squeezed.transpose(); // Shape: [8400, 5]
    console.log(`After transposing, shape: [${outputs_transposed.shape}]`);

    // Step 3: Filter rows where the 5th property (confidence) > 0.01
    let confidence_scores = outputs_transposed.slice([0, 4], [-1, 1]); // Shape: [8400, 1]
    let mask = confidence_scores.greater(0.01).reshape([-1]); // Shape: [8400]

    // Use tf.booleanMaskAsync instead of tf.booleanMask
    let filtered_outputs = await tf.booleanMaskAsync(outputs_transposed, mask) // Shape: [N, 5]
    console.log(`After filtering, shape: [${filtered_outputs.shape}]`);
    if ( this.logLevel >= 3 ) {
      console.log('First 10 elements after filtering:');
      filtered_outputs.slice([0, 0], [10, -1]).print();
    }

    // Step 4: Separate first 4 properties and confidence
    let xywh = filtered_outputs.slice([0, 0], [-1, 4]) as tf.Tensor2D; // Shape: [N, 4]
    let confidences = filtered_outputs.slice([0, 4], [-1, 1]).reshape([-1]) as tf.Tensor1D; // Shape: [N, 1]
    this.log(`xywh shape: [${xywh.shape}]`, 2);
    this.log(`Confidences shape: [${confidences.shape}]`, 2);
    if ( this.logLevel >= 3 ) {
      this.log('First 10 xywh values:', 3);
      xywh.slice([0, 0], [10, -1]).print();
      this.log('First 10 confidence values:', 3);
      confidences.slice(0, 10).print();
    }

    // Apply Non-Max Suppression
    const { finalBoxes, finalScores } = await this.applyNMS(xywh, confidences);
    
    // Return the resulting tensors
    return { final_boxes: finalBoxes, final_scores: finalScores };
  }


  async tensorToEllipses(
    final_boxes: tf.Tensor,
    final_scores: tf.Tensor
  ) {
    // Explicitly type the arrays
    const boxes_xywh_array = (await final_boxes.array()) as number[][]; // Shape: [N, 4]
    const scores_array = (await final_scores.array()) as number[];      // Shape: [N]
  
    // Combine boxes and scores into a single array
    const predictions_array = boxes_xywh_array.map((box: number[], idx: number) => ({
      box,
      score: scores_array[idx],
    }));
  
    // Sort predictions based on y_center (box[1])
    predictions_array.sort((a, b) => a.box[1] - b.box[1]);
  
    this.log('Ellipses processed from tensor data.', 2);
  
    // Map each prediction to ellipse parameters
    return predictions_array.map((pred: any, index: number) => {
      const box = pred.box; // box is [x_center, y_center, width, height]
  
      // Compute ellipse parameters
      const centerX = box[0] / this.baseResolution; 
      const centerY = box[1] / this.baseResolution;
      const radiusX = (box[2] / this.baseResolution) / 2;
      const radiusY = (box[3] / this.baseResolution) / 2;
  
      this.log(`Ellipse ${index} center: (${centerX}, ${centerY}), radii: (${radiusX}, ${radiusY})`, 3);
  
      return {
        centerX,
        centerY,
        radiusX,
        radiusY,
        index,
        score: pred.score,
      };
    });
  }
  
  
  drawEllipses(ctx: CanvasRenderingContext2D, ellipses: any[], threshold: number): number {
    let total = 0;
  
    // Ensure the original image is drawn before drawing ellipses
    if (this.originalImage instanceof HTMLImageElement && this.ctx) {
      this.log('Restoring original image before drawing ellipses.', 1);
      
      // Clear the canvas before redrawing the image
      this.ctx.clearRect(0, 0, this.canvas!.width, this.canvas!.height);
      
      // Draw the original image
      this.drawImageRounded(this.ctx, this.originalImage);

    } else {
      this.log('Original image not available. Skipping image restoration.', 1);
    }
  
    // Now proceed to draw the ellipses on top of the restored image
    if (ellipses.length === 0) {
      console.log('No ellipses to draw.');
      return 0; // o cualquier valor que quieras devolver en caso de lista vacía
    } else {
      ellipses.forEach(({ centerX, centerY, radiusX, radiusY, index, score }) => {
        if (score > threshold) {
          centerX = Math.round(centerX * this.originalImage!.naturalWidth);
          centerY = Math.round(centerY * this.originalImage!.naturalHeight);
          radiusX = Math.round(radiusX * this.originalImage!.naturalWidth);
          radiusY = Math.round(radiusY * this.originalImage!.naturalHeight);

          radiusX = Math.abs(radiusX);
          radiusY = Math.abs(radiusY);
          this.log(`Drawing ellipse ${index} with score ${score.toFixed(2)} center=(${centerX},${centerY}) radius=(${radiusX},${radiusY})`, 3);
      
          // Draw black outline for ellipse
          ctx.beginPath();
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 0.01 * this.originalImage!.naturalWidth;
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.stroke();
      
          // Asignar color basado en el índice (index)
          let color = '';
          if (score < 0.5) {
            color = 'red';
          } else if (score < 0.75) {
            color = 'yellow';
          } else {
            color = 'green';
          }
      
          // Draw colored ellipse
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.005 * this.originalImage!.naturalWidth;;
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.closePath();
      
          total++;
        }
      }    
    );
    }
  
    this.log(`Total objects drawn: ${total}`, 1);
    this.badgeCount = total;
    return total;
  }
  

  async drawImageRounded(canvasOrCtx: HTMLCanvasElement | CanvasRenderingContext2D, imageInput: string | HTMLImageElement) {
    let ctx: CanvasRenderingContext2D;
    let canvas: HTMLCanvasElement;
    let file: File;
  
    // Verificar si el primer parámetro es un Canvas o un Contexto
    if (canvasOrCtx instanceof HTMLCanvasElement) {
      canvas = canvasOrCtx;
      ctx = canvas.getContext('2d')!;
    } else if (canvasOrCtx instanceof CanvasRenderingContext2D) {
      ctx = canvasOrCtx;
      canvas = ctx.canvas; // Obtener el canvas desde el contexto
    } else {
      console.error('Invalid parameter: must be a Canvas or a CanvasRenderingContext2D.');
      return;
    }
  
    if (!ctx) {
      console.error('Canvas context is not available.');
      return;
    }
  
    // Verificar si el parámetro es un string (ruta de archivo) o una instancia de HTMLImageElement
    let img: HTMLImageElement;
  
    if (typeof imageInput === 'string') {
      // El parámetro es un nombre de archivo o URL, cargar la imagen desde la URL
      this.log('Received filename.', 2);
      
      try {
        // Utilizar fetch para obtener el archivo desde la URL
        const response = await fetch(imageInput);
        
        if (!response.ok) {
          throw new Error(`Failed to load image from URL: ${imageInput}`);
        }
  
        const blob = await response.blob();
        file = new File([blob], imageInput.split('/').pop()!, { type: blob.type });
  
        // Crear una instancia de imagen desde el archivo
        img = new Image();
        img.src = URL.createObjectURL(file);
      } catch (error) {
        console.error('Error loading image:', error);
        this.showLoading(false, '');
        return;
      }
    } else if (imageInput instanceof HTMLImageElement) {
      // El parámetro ya es una instancia de imagen, usar directamente
      img = imageInput;
    } else {
      console.error('Invalid image input: must be a string (filename) or HTMLImageElement.');
      return;
    }
  
    // Verificar si la imagen ya está cargada
    if (img.complete) {
      // Si la imagen ya está cargada, dibujar directamente
      this.drawRoundedImageOnCanvas(ctx, img, canvas);
    } else {
      // Si la imagen no está cargada, esperar a que se cargue
      img.onload = () => {
        this.drawRoundedImageOnCanvas(ctx, img, canvas);
      };
    }
  }
  
  // Función auxiliar para dibujar la imagen redondeada en el canvas
  drawRoundedImageOnCanvas(ctx: CanvasRenderingContext2D, img: HTMLImageElement, canvas: HTMLCanvasElement) {
    const border_size = 15;
    this.adjustCanvasDimensions(img);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#332007';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    // Dibujar el rectángulo redondeado y la imagen
    ctx.beginPath();
    ctx.moveTo(border_size, 0);
    ctx.lineTo(canvas.width - border_size, 0);
    ctx.quadraticCurveTo(canvas.width, 0, canvas.width, border_size);
    ctx.lineTo(canvas.width, canvas.height - border_size);
    ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - border_size, canvas.height);
    ctx.lineTo(border_size, canvas.height);
    ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - border_size);
    ctx.lineTo(0, border_size);
    ctx.quadraticCurveTo(0, 0, border_size, 0);
    ctx.closePath();
    ctx.clip();
  
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  

  increaseSensitivity() {
    if (this.confidenceSlider < 10) {
      this.confidenceSlider++;
      this.updateSensitivity();
    }
  }

  decreaseSensitivity() {
    if (this.confidenceSlider > 1) {
      this.confidenceSlider--;
      this.updateSensitivity();
    }
  }

  updateSensitivity() {
    this.thresholdValue = this.confidenceSlider;
    this.log(`Sensitivity updated: ${this.thresholdValue}`, 2);

    this.confidence_threshold = this.calcConfidenceThreshold(this.thresholdValue);
    this.log(`Confidence threshold updated to: ${this.confidence_threshold}`, 2);

    if (this.ctx) {
      this.drawEllipses(this.ctx, this.ellipses, this.confidence_threshold);
    }
  }
}
