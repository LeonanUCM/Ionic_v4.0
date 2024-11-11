import { StorageService } from '../services/storage.service';
import { UploaderService } from '../services/uploader.service';
import { ResultData } from 'src/app/models/resultData';
import { Injectable } from '@angular/core';
import { LoadingController, ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import * as tf from '@tensorflow/tfjs';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { addIcons } from 'ionicons';
import { add, remove } from 'ionicons/icons';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root',
})
export class FruitCountService {
  public isDecreaseDisabled: boolean = false;
  public isIncreaseDisabled: boolean = false;
  public isNextDisabled: boolean = false;
  public fileIndex: number = 0;
  public isBadgeOpenFilesVisible: boolean = false;
  private logLevel: number = 2;
  private model: tf.GraphModel | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private originalImage: HTMLImageElement | null = null;
  private loadingInstance: HTMLIonLoadingElement | null = null;
  private scoreThreshold: number = 0;
  private iouThreshold: number = 0;
  private predictionsData: any[] = [];
  private modelFilename: string = '';
  private fruitSampleFilename: string = '';
  private baseResolution: number = 640; 
  private _sensitivityValue: number = 0;
  private _sensitivityText: string = 'N';
  private _totalSelectedObjects: number = 0;
  private predictBoxes: tf.Tensor | undefined;
  private predictScores: tf.Tensor | undefined;
  private _fruitName: string = '';
  private imageFilename: string = '';
  private imageExample: boolean = true;
  private totalObjects: number = 0;
  private lastDevicePixelRatio = window.devicePixelRatio;
  private showNumbers: boolean = true;
  private showCircles: boolean = true; 
  private fruitType: string = '';
  private fruitSubType: string = '';


  constructor(
    private loadingController: LoadingController, 
    private toastController: ToastController,
    private storageService: StorageService,
    private uploaderService: UploaderService
  ) 
  { 
    addIcons({ add });
    addIcons({ remove });
  }

//////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Initializes the service with specified fruit type, subtype, and other parameters.
   * @param fruitType - Type of the fruit.
   * @param fruitSubType - Subtype of the fruit.
   * @param fruitLocalName - Localized name of the fruit.
   * @param ApiUrl - API URL for cloud upload service.
   */
  public initialize(fruitType: string, fruitSubType: string, fruitLocalName: string) {
    // Configure the model and fruit names
    console.log(`configureFruitType: type: ${fruitType}, sub-type: ${fruitSubType}, local name: ${fruitLocalName}`);
    this.fruitType = fruitType;
    this.fruitSubType = fruitSubType;
    this.fruitName = `${fruitLocalName} ${fruitSubType === 'tree' ? ' en árbol' : ' en suelo'}`;
    this.fruitSampleFilename = `./assets/images/${fruitType}-${fruitSubType}.jpg`;
    this.modelFilename = `./assets/models/${fruitType}-model_js/model.json`;
    this.iouThreshold = 0.5;
    console.log(`Model: ${this.modelFilename}, Sample: ${this.fruitSampleFilename}`);

    this.initializeEventListeners();

    this.calculateScoreThreshold(this.sensitivityValue);
    console.log(`Initial confidence threshold: ${this.scoreThreshold}`, 2);

    // Draw the sample image and load the model
    //this.drawRoundedImage(this.canvas!, this.fruitSampleFilename);
    this.loadModel(true);
    this.handleImageUpload(this.fruitSampleFilename);
  }


  // Getters and Setters for _sensitivityValue
  public get sensitivityValue(): number {
    return this._sensitivityValue;
  }

  public set sensitivityValue(value: number) {
    this._sensitivityValue = value;
  }

  // Getters and Setters for _sensitivityText
  public get sensitivityText(): string {
    return this._sensitivityText;
  }

  public set sensitivityText(value: string) {
    this._sensitivityText = value;
  }

  // Getters and Setters for _fruitName
  public get fruitName(): string {
    return this._fruitName;
  }

  public set fruitName(value: string) {
    this._fruitName = value;
  }

  // Getters and Setters for _totalSelectedObjects
  public get totalSelectedObjects(): number {
    return this._totalSelectedObjects;
  }

  private set totalSelectedObjects(value: number) {
    this._totalSelectedObjects = value;
  }

  // Method to slice a 2D array in TypeScript
/**
 * The `slice` function in TypeScript extracts a rectangular portion of a 2D array based on specified
 * row and column ranges.
 * @param {number[][]} array - The `array` parameter is a two-dimensional array of numbers.
 * @param {number} startRow - The `startRow` parameter in the `slice` function represents the index of
 * the row where the slicing should start in the 2D `array`.
 * @param {number} endRow - The `endRow` parameter in the `slice` function represents the ending row
 * index (exclusive) for the slice operation on a 2D array. It indicates the row index up to which the
 * slicing will be performed (not including the row at this index).
 * @param {number} startCol - The `startCol` parameter in the `slice` function represents the starting
 * column index from which to begin slicing the array.
 * @param {number} endCol - The `endCol` parameter in the `slice` function represents the ending column
 * index for the slice operation on a 2D array. It specifies the column index up to which elements will
 * be sliced (excluding the element at the `endCol` index).
 * @returns The `slice` method is returning a 2D array of numbers that is a subset of the input
 * `array`. The subset is determined by the specified `startRow`, `endRow`, `startCol`, and `endCol`
 * parameters.
 */
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
/**
 * The `shape` function in TypeScript returns the number of rows and columns in a 2D array.
 * @param {number[][]} array - The `array` parameter in the `shape` function is a two-dimensional array
 * of numbers.
 * @returns An array containing the number of rows and number of columns in the input `array` is being
 * returned.
 */
  static shape(array: number[][]): [number, number] {
    const rows = array.length;
    const cols = array[0].length;
    return [rows, cols];
  }

  
  //////////////////////////////////////////////////////////////////////////////////////////////
  
  // Show loading with a customizable message and minimum duration
  private async showLoading(message: string = 'Please wait...', minDuration: number = 300) {
    // Avoid creating multiple loading controllers
    if (this.loadingInstance) {
      return;
    }

    // Create loading instance
    this.loadingInstance = await this.loadingController.create({
      message: message,
      spinner: 'bubbles',  // Modern spinner style (crescent, dots, bubbles, etc.)
      cssClass: 'custom-loading-class',  // Optional: Custom CSS class for styling
      backdropDismiss: false, // Optional: Prevent dismissing by tapping the backdrop
    });

    // Show loading spinner
    await this.loadingInstance.present();

    // Ensure loading is visible for at least minDuration
    return new Promise<void>(resolve => setTimeout(resolve, minDuration));
  }

  // Hide loading if it's currently active
  private async hideLoading() {
    try {
      if (this.loadingInstance) {
        await this.loadingInstance.dismiss();
        this.loadingInstance = null;  // Clear the reference after dismiss
      }
    } catch (error) {
      console.error('Error while hiding loading:', error);
    }
  }  

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Initializes event listeners for UI elements and window resize.
   */
  private initializeEventListeners() {
    console.log('Initializing event listeners.');

    this.canvas = document.getElementById('resultCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d');

    // Listen for window resize to adjust canvas dimensions
    window.addEventListener('resize', () => {
      const currentDevicePixelRatio = window.devicePixelRatio;
    
      if (this.lastDevicePixelRatio !== currentDevicePixelRatio) {
        // Zoom event detected, skip canvas adjustment
        console.log("Zoom detected, skipping canvas adjustment.");
        this.lastDevicePixelRatio = currentDevicePixelRatio;
      } else {
        // Window resize event, proceed with canvas adjustment
        requestAnimationFrame(() => {
          this.adjustCanvasDimensions(this.originalImage!);
          if (this.ctx) {
            this.drawEllipses(false);
          }
        });
      }
    });
  }


  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Loads the TensorFlow.js model, reloading if specified.
   * @param reload - If true, forces model reload.
   */
  public async loadModel(reload: boolean = false) {
    console.log(`TensorFlow.js version: ${tf.version.tfjs}`);

    if (this.model !== null && !reload) {
      console.log('Model already loaded. Skipping re-load.');
      return;
    }

    try {
      this.model = await tf.loadGraphModel(this.modelFilename);
      console.log('Model loaded successfully.');
    } catch (error) {
      console.error('Error loading the model:', error);
      alert('Error loading the model. Check the console for more details.');
    } finally {
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Handles image upload, processing the file and preparing it for analysis.
   * @param input - Event or filename for the image to be uploaded.
   */
  public async handleImageUpload(input: any) {
    console.log('Image upload triggered.');

    let files: FileList | File[] = [];
  
    // Check if the input is an event with files or a single file URL
    if (typeof input === 'string') {
      console.log(`Received filename: ${input}`, 2);
      this.imageExample = ( this.fruitSampleFilename === input );

      try {
        const response = await fetch(input);
        if (!response.ok) {
          throw new Error(`Failed to load image from URL: ${input}`);
        }
  
        const blob = await response.blob();
        const file = new File([blob], input.split('/').pop()!, { type: blob.type });
        files = [file]; // Process as a single file
      } catch (error) {
        console.error('Error loading image:', error);
        return;
      }
    } else if (input && input.target && input.target.files && input.target.files.length > 0) {
      console.log('Received event with multiple files.');
      this.imageExample = false;
      this.isBadgeOpenFilesVisible = true;
      files = input.target.files; // Store all selected files
    } else {
      throw new Error('Invalid input: Expected a file event or a filename.');
    }
    this.isNextDisabled = this.imageExample;
    const numImagesOpened = files.length;
  
    // Function to handle each file sequentially
    const processFile = async (index: number) => {
      this.fileIndex = numImagesOpened - index;

      if (index >= numImagesOpened) {
        console.log('All files processed.');
        this.isBadgeOpenFilesVisible = false;
        this.isNextDisabled = true;
        return; // No more files to process
      }

      const file = files[index];
      this.imageFilename = file.name;
      console.log(`Processing file: ${this.imageFilename}`, 2);
  
      try {
        this.resetSensitivity();
  
        // Clear previous predictions and object count
        this.predictionsData.length = 0;
        this.totalSelectedObjects = 0;
  
        const img = new Image();
        img.src = URL.createObjectURL(file);
  
        img.onload = async () => {
          if (this.ctx) {
            console.log(`Saving original image.`);
            this.originalImage = img;
          }
  
          const inputTensor = this.convertImageToTensor(img);
          console.log(`Input tensor shape: ${inputTensor.shape}`, 1);
  
          try {
            let message = '';
            if ( this.imageExample )
              message = `Cargando modelo...`;
            else if (numImagesOpened > 1)
              message = `Analizando imagen ${index+1}/${numImagesOpened}...`;
            else
              message = 'Analizando imagen...';

            await this.showLoading(message);
            const result = await this.predict(inputTensor);
            if (!result || !this.predictBoxes || !this.predictScores) {
              throw new Error('No results received from prediction.');
            }
  
            await this.drawEllipses();
          } catch (error) {
            console.error('Error during prediction:', error);
          } finally {
            tf.dispose([inputTensor]);
            await this.hideLoading();
          }
        };
      } catch (error) {
        console.error('Error loading the image:', error);
      } finally {
        // If there are more files to process, wait for the user to click the "Next" button
        const nextButton = document.getElementById('nextButton')!;
        nextButton.onclick = () => {
          this.shareCanvasImage("cloud");
          processFile(index + 1); // Process the next file
        };
      }
    };
  
    // Start processing the first file
    processFile(0);
  }
  

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Logs messages based on the specified log level.
   * @param message The message to log.
   * @param level The severity level of the log (default is 3).
  */
  public handleSliderChange(event: any) {
    this.calculateScoreThreshold(parseInt(event.target.value));
    console.log(`Confidence threshold updated: ${this.scoreThreshold}`, 1);

    if (this.ctx) {
      this.drawEllipses();
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Converts an image to a TensorFlow.js tensor.
   * @param img The HTMLImageElement to convert.
   * @returns The resulting tensor.
   */
  private convertImageToTensor(img: HTMLImageElement): tf.Tensor {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.baseResolution;
    tempCanvas.height = this.baseResolution;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      throw new Error('Failed to get temporary canvas context.');
    }
    tempCtx.drawImage(img, 0, 0, this.baseResolution, this.baseResolution);
    const imageData = tempCtx.getImageData(0, 0, this.baseResolution, this.baseResolution);

    // Convert the image to a tensor
    let tensor = tf.browser.fromPixels(imageData).toFloat().div(255.0);

    // Add an extra batch dimension
    tensor = tensor.expandDims(0);

    console.log(`Image shape: ${tensor.shape}`, 2);
    return tensor;
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Predicts objects in the input tensor using the loaded model.
   * @param inputTensor The input tensor representing the image.
   * @returns An object containing the final boxes and scores tensors.
   */
  private async predict(inputTensor: tf.Tensor): Promise<{ final_boxes: tf.Tensor; final_scores: tf.Tensor } | undefined> {
    if (!this.model) {
      console.error('Model is not loaded.');
      return undefined;
    }

    console.log(`Input tensor shape: ${inputTensor.shape}`, 2);
    let outputs: any;
    try {
      outputs = this.model.execute(inputTensor);
    } catch (error) {
      console.error('Error during model execution:', error);
      return undefined;
    }

    // Step 1: Remove dimension 0
    let outputsSqueezed = outputs.squeeze([0]); // Shape: [5, 8400]
    console.log(`After squeezing, shape: [${outputsSqueezed.shape}]`);
    if (this.logLevel >= 3) {
      console.log('First 10 elements after squeezing (along each of the 5 properties):');
      outputsSqueezed.slice([0, 0], [5, 10]).print();
    }

    // Step 2: Transpose to get [8400, 5]
    let outputsTransposed = outputsSqueezed.transpose(); // Shape: [8400, 5]
    console.log(`After transposing, shape: [${outputsTransposed.shape}]`);

    // Step 3: Filter rows where the 5th property (confidence) > 0.01
    let confidenceScores = outputsTransposed.slice([0, 4], [-1, 1]); // Shape: [8400, 1]
    let mask = confidenceScores.greater(0.01).reshape([-1]); // Shape: [8400]

    // Use tf.booleanMaskAsync instead of tf.booleanMask
    let filteredOutputs = await tf.booleanMaskAsync(outputsTransposed, mask); // Shape: [N, 5]
    console.log(`After filtering, shape: [${filteredOutputs.shape}]`);
    if (this.logLevel >= 3) {
      console.log('First 10 elements after filtering:');
      filteredOutputs.slice([0, 0], [10, -1]).print();
    }

    // Step 4: Separate first 4 properties and confidence
    let xywh = filteredOutputs.slice([0, 0], [-1, 4]) as tf.Tensor2D; // Shape: [N, 4]
    let confidences = filteredOutputs.slice([0, 4], [-1, 1]).reshape([-1]) as tf.Tensor1D; // Shape: [N]
    console.log(`xywh shape: [${xywh.shape}]`, 2);
    console.log(`Confidences shape: [${confidences.shape}]`, 2);
    if (this.logLevel >= 3) {
      console.log('First 10 xywh values:');
      xywh.slice([0, 0], [10, -1]).print();
      console.log('First 10 confidence values:');
      confidences.slice(0, 10).print();
    }

    // Assign the predictBoxes and predictScores tensors
    this.predictBoxes = xywh;
    this.predictScores = confidences;
    this.totalObjects = this.predictScores.shape[0];

    // Return the resulting tensors
    return { final_boxes: this.predictBoxes, final_scores: this.predictScores };
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Applies Non-Max Suppression to filter overlapping boxes.
   * @param boxes The tensor containing box coordinates.
   * @param scores The tensor containing confidence scores.
   * @param iouThreshold The Intersection over Union threshold.
   * @param maxOutputSize The maximum number of boxes to output.
   * @returns An object containing the final boxes and scores tensors.
   */
  private async applyNonMaxSuppression(
    maxOutputSize: number = 300
  ): Promise<{ filteredBoxes: tf.Tensor2D; filteredScores: tf.Tensor1D }> {
    // Extract x_center, y_center, width, height
    const xCenters = this.predictBoxes!.slice([0, 0], [-1, 1]); // Shape: [N, 1]
    const yCenters = this.predictBoxes!.slice([0, 1], [-1, 1]); // Shape: [N, 1]
    const widths = this.predictBoxes!.slice([0, 2], [-1, 1]);   // Shape: [N, 1]
    const heights = this.predictBoxes!.slice([0, 3], [-1, 1]);  // Shape: [N, 1]

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
    const convertedScores = this.predictScores! as tf.Tensor1D

    

    // Apply Non-Max Suppression
    console.log(`Applying NMS iouThreshold=${this.iouThreshold} scoreThreshold=${this.scoreThreshold}`, 2);
    const nmsIndices = await tf.image.nonMaxSuppressionAsync(
      convertedBoxes,
      convertedScores,
      maxOutputSize,
      this.iouThreshold,
      this.scoreThreshold
    );

    // Gather the filtered boxes and scores
    const filteredBoxes = this.predictBoxes!.gather(nmsIndices) as tf.Tensor2D;
    const filteredScores = this.predictScores!.gather(nmsIndices) as tf.Tensor1D;

    return { filteredBoxes: filteredBoxes, filteredScores: filteredScores };
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Converts tensors to ellipse parameters.
   * @param this.predictBoxes The tensor containing final box coordinates.
   * @param this.predictScores The tensor containing final confidence scores.
   * @returns An array of ellipse parameters.
   */
  private async tensorToEllipses(
    boxes: tf.Tensor,
    scores: tf.Tensor
  ): Promise<any[]> {
    // Explicitly type the arrays
    const boxesXYWHArray = (await boxes.array()) as number[][]; // Shape: [N, 4]
    const scoresArray = (await scores.array()) as number[];      // Shape: [N]

    // Combine boxes and scores into a single array
    const predictionsArray = boxesXYWHArray.map((box: number[], idx: number) => ({
      box,
      score: scoresArray[idx],
    }));

    // Sort predictions based on y_center (box[1])
    predictionsArray.sort((a, b) => a.box[1] - b.box[1]);

    console.log('Ellipses processed from tensor data.');

    // Map each prediction to ellipse parameters
    return predictionsArray.map((pred: any, index: number) => {
      const box = pred.box; // box is [x_center, y_center, width, height]

      // Compute ellipse parameters
      const centerX = box[0] / this.baseResolution; 
      const centerY = box[1] / this.baseResolution;
      const radiusX = (box[2] / this.baseResolution) / 2;
      const radiusY = (box[3] / this.baseResolution) / 2;

      if ( this.logLevel >= 3) 
        console.log(`Ellipse ${index} center: (${centerX}, ${centerY}), radii: (${radiusX}, ${radiusY})`, 3);

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

  //////////////////////////////////////////////////////////////////////////////////////////////
  // Helper function to introduce a delay
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Draws ellipses on the canvas based on detected objects.
   * @param ctx The canvas rendering context.
   * @param ellipses The array of ellipse parameters.
   * @param threshold The confidence threshold for drawing.
   * @returns The total number of objects drawn.
   */
  private async drawEllipses(showMessage: boolean = true): Promise<void> {
    if (this.predictBoxes && this.predictScores && this.ctx) {
      const total_before = this.totalSelectedObjects;
      console.log(`Starting to analyze ${this.totalObjects} objects.`, 2);
      const {filteredBoxes, filteredScores} = await this.applyNonMaxSuppression();
      const ellipses = await this.tensorToEllipses(filteredBoxes, filteredScores);
      this.totalSelectedObjects = ellipses.length;
      console.log(`Selected ${this.totalSelectedObjects} objects.`, 2);

      if (showMessage) {
        if (total_before == 0) {	
          this.presentToast(`Se han detectado ${this.totalSelectedObjects} ${this.fruitName}.`, 'bottom');
        } else if (this.totalSelectedObjects === 0) { 
          this.presentToast(`No se ha detectado ningún ${this.fruitName} con esa sensibilidad.`, 'bottom');
        } 
        else if (this.totalSelectedObjects > total_before ) {	
          this.presentToast(`Encontrados ${this.totalSelectedObjects - total_before} más.`, 'bottom');      
        }
        else if (this.totalSelectedObjects < total_before ) {	
          this.presentToast(`Descartados ${total_before - this.totalSelectedObjects} entre los menos probables.`, 'bottom');      
        }
        else {
          this.presentToast(`Ningún cambio en número de frutos.`, 'bottom');
        }
      }

      // Restore the original image before drawing ellipses
      if (this.originalImage instanceof HTMLImageElement && this.ctx) {
        console.log('Restoring original image before drawing ellipses.');
        
        // Clear the canvas before redrawing the image
        this.ctx.clearRect(0, 0, this.canvas!.width, this.canvas!.height);
        
        // Draw the original image
        this.drawRoundedImage(this.ctx, this.originalImage);
      } else {
        console.log('Original image not available. Skipping image restoration.');
      }
  
      // Proceed to draw the ellipses on top of the restored image
      if (this.totalSelectedObjects === 0) {
        console.log('No ellipses to draw.');
        return;
      } else {
        // Use a for...of loop to handle async await
        for (const { centerX, centerY, radiusX, radiusY, index, score } of ellipses) {
  
          if (score > this.scoreThreshold) {
            let scaledCenterX = Math.round(centerX * this.originalImage!.naturalWidth);
            let scaledCenterY = Math.round(centerY * this.originalImage!.naturalHeight);
            let scaledRadiusX = Math.round(radiusX * this.originalImage!.naturalWidth);
            let scaledRadiusY = Math.round(radiusY * this.originalImage!.naturalHeight);
  
            scaledRadiusX = Math.abs(scaledRadiusX);
            scaledRadiusY = Math.abs(scaledRadiusY);
            if ( this.logLevel >= 3) 
              console.log(`Drawing ellipse ${index} with score ${score.toFixed(2)} center=(${scaledCenterX},${scaledCenterY}) radius=(${scaledRadiusX},${scaledRadiusY})`, 3);
        
            this.ctx!.beginPath();
            if (this.showCircles) {
              // Draw black outline for ellipse
              this.ctx!.strokeStyle = 'black';
              this.ctx!.globalAlpha = 0.7;
              this.ctx!.lineWidth = 0.009 * this.originalImage!.naturalWidth;
              this.ctx!.ellipse(scaledCenterX, scaledCenterY, scaledRadiusX, scaledRadiusY, 0, 0, 2 * Math.PI);
              this.ctx!.stroke();
          
              // Assign color based on score
              let color = '';
              if (score < 0.5) {
                color = '#FA6F58'; // red
              } else if (score < 0.75) {
                color = '#FFFC32'; // yellow
              } else {
                color = '#29E609'; // green
              }
          
              // Draw colored ellipse
              this.ctx!.strokeStyle = color;
              this.ctx!.globalAlpha = 1.0;
              this.ctx!.lineWidth = 0.002 * this.originalImage!.naturalWidth;
              this.ctx!.ellipse(scaledCenterX, scaledCenterY, scaledRadiusX, scaledRadiusY, 0, 0, 2 * Math.PI);
              this.ctx!.stroke();
            }

            if (this.showNumbers) {
              // Add index text at the center of the ellipse
              this.ctx!.font = `${0.015 * this.originalImage!.naturalWidth}px Arial`; // Set font size relative to image size
              this.ctx!.fillStyle = '#EEEEEE'; // Set text color
              this.ctx!.textAlign = 'center'; // Center the text horizontally
              this.ctx!.textBaseline = 'middle'; // Center the text vertically
              this.ctx!.strokeStyle = '#222222'; // Set outline color
              this.ctx!.lineWidth = 0.003 * this.originalImage!.naturalWidth;
              this.ctx!.globalAlpha = 0.7;
              this.ctx!.strokeText((index+1).toString(), scaledCenterX, scaledCenterY);
              this.ctx!.globalAlpha = 1.00;
              this.ctx!.fillText((index+1).toString(), scaledCenterX, scaledCenterY); // Draw the index text
            }

            
            this.ctx!.closePath();

            this.ctx!.globalAlpha = 1.00;
          }
        }
      }

      // Title

      this.drawBox(`${this.totalSelectedObjects}`, 'top-left', 'large');
      {
        const nextButton = document.getElementById('nextButton') as HTMLButtonElement;
        if ( this.imageExample ) {
          nextButton.disabled = true;
          this.drawBox('Imagen de Ejemplo', 'middle-center', 'large');
        }
        else {
          nextButton.disabled = false;
          this.drawBox(this.imageFilename, 'top-center', 'small');
        }
      }

      this.drawBox(this.fruitName, 'bottom-center', 'small');
      console.log(`Total objects drawn: ${this.totalSelectedObjects}`, 1);
    }    
    return;
  }
  

  //////////////////////////////////////////////////////////////////////////////////////////////


  /**
   * Draws a text box on the canvas at the specified position.
   *
   * @param text - The text to be displayed inside the box.
   * @param position - The position of the box on the canvas. It can be one of the following:
   *   - 'top-left'
   *   - 'top-center'
   *   - 'top-right'
   *   - 'middle-left'
   *   - 'middle-center'
   *   - 'middle-right'
   *   - 'bottom-left'
   *   - 'bottom-center'
   *   - 'bottom-right'
   *
   * The function calculates the dimensions of the box based on the text size and padding,
   * and positions it according to the specified position. It then draws a rounded rectangle
   * with a semi-transparent background and places the text centered within the box.
   *
   * If the canvas context (`this.ctx`) is not available, it logs an error and returns.
   *
   * @returns {void}
   */
  private drawBox(
    text: string,
    position:
      | 'top-left'
      | 'top-center'
      | 'top-right'
      | 'middle-left'
      | 'middle-center'
      | 'middle-right'
      | 'bottom-left'
      | 'bottom-center'
      | 'bottom-right',
    text_size: 'small' | 'medium' | 'large' = 'medium'
  ): void {
    if (!this.ctx) {
      console.error('Canvas context not available.');
      return;
    }
  
    // Obtener las dimensiones naturales de la imagen
    const imgWidth = this.originalImage!.naturalWidth;
    const imgHeight = this.originalImage!.naturalHeight;
  
    // Ajustar el tamaño de la fuente según el valor de text_size
    let fontSize;
    switch (text_size) {
      case 'small':
        fontSize = 0.013 * imgWidth;
        break;
      case 'medium':
        fontSize = 0.02 * imgWidth;
        break;
      case 'large':
        fontSize = 0.03 * imgWidth;
        break;
    }
  
    // Medir el ancho del texto
    this.ctx!.font = `${fontSize}px Arial`;
    const textMetrics = this.ctx!.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize; // Aproximación de la altura del texto
  
    // Calcular el padding alrededor del texto
    const paddingX = fontSize/2; // Padding horizontal
    const paddingY = fontSize/2; // Padding vertical
  
    // Calcular las dimensiones del cuadro basadas en el tamaño del texto y el padding
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = textHeight + paddingY * 2;
  
    let boxX = 0;
    let boxY = 0;
  
    // Calcular la posición X
    switch (position) {
      case 'top-left':
      case 'middle-left':
      case 'bottom-left':
        boxX = imgWidth * 0.02; // 2% desde el borde izquierdo
        break;
      case 'top-center':
      case 'middle-center':
      case 'bottom-center':
        boxX = (imgWidth - boxWidth) / 2; // Centrado horizontalmente
        break;
      case 'top-right':
      case 'middle-right':
      case 'bottom-right':
        boxX = imgWidth - boxWidth - imgWidth * 0.02; // 2% desde el borde derecho
        break;
    }
  
    // Calcular la posición Y
    switch (position) {
      case 'top-left':
      case 'top-center':
      case 'top-right':
        boxY = imgHeight * 0.02; // 2% desde el borde superior
        break;
      case 'middle-left':
      case 'middle-center':
      case 'middle-right':
        boxY = (imgHeight - boxHeight) / 2; // Centrado verticalmente
        break;
      case 'bottom-left':
      case 'bottom-center':
      case 'bottom-right':
        boxY = imgHeight - boxHeight - imgHeight * 0.02; // 2% desde el borde inferior
        break;
    }
  
    // Dibujar el rectángulo redondeado
    const radius = Math.min(boxWidth, boxHeight) * 0.2;
    this.drawRoundedRect(this.ctx!, boxX, boxY, boxWidth, boxHeight, radius);
  
    // Configurar las propiedades del texto
    this.ctx!.fillStyle = '#FFFFFF'; // Color del texto (blanco)
    this.ctx!.textAlign = 'center'; // Centrar el texto horizontalmente
    this.ctx!.textBaseline = 'middle'; // Centrar el texto verticalmente
  
    // Añadir el texto dentro del cuadro
    const textX = boxX + boxWidth / 2; // Centro del cuadro en X
    const textY = boxY + boxHeight / 2; // Centro del cuadro en Y

    this.ctx!.strokeStyle = '#222222'; // Set outline color
    this.ctx!.lineWidth = 0.003 * this.originalImage!.naturalWidth;
    this.ctx!.globalAlpha = 0.7;
    this.ctx!.strokeText(text, textX, textY);
    this.ctx!.globalAlpha = 1.00;
    this.ctx!.fillText(text, textX, textY);


    console.log(`Drawn box with text: "${text}" at position ${position} (${boxX},${boxY})`, 3);
  }
  
  

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Draws a rounded image on the canvas.
   * @param canvasOrCtx The canvas element or its rendering context.
   * @param imageInput The image source as a filename or HTMLImageElement.
   */
  private async drawRoundedImage(canvasOrCtx: HTMLCanvasElement | CanvasRenderingContext2D, imageInput: string | HTMLImageElement) {
    let ctx: CanvasRenderingContext2D;
    let canvas: HTMLCanvasElement;
    let file: File;

    // Determine if the first parameter is a Canvas or a Context
    if (canvasOrCtx instanceof HTMLCanvasElement) {
      canvas = canvasOrCtx;
      ctx = canvas.getContext('2d')!;
    } else if (canvasOrCtx instanceof CanvasRenderingContext2D) {
      ctx = canvasOrCtx;
      canvas = ctx.canvas;
    } else {
      console.error('Invalid parameter: must be a Canvas or a CanvasRenderingContext2D.');
      return;
    }

    if (!ctx) {
      console.error('Canvas context is not available.');
      return;
    }

    // Determine if the imageInput is a string (filename) or an HTMLImageElement
    let img: HTMLImageElement;

    if (typeof imageInput === 'string') {
      console.log('Received filename.');
      
      try {
        const response = await fetch(imageInput);
        if (!response.ok) {
          throw new Error(`Failed to load image from URL: ${imageInput}`);
        }

        const blob = await response.blob();
        file = new File([blob], imageInput.split('/').pop()!, { type: blob.type });

        // Create an image instance from the file
        img = new Image();
        img.src = URL.createObjectURL(file);
      } catch (error) {
        console.error('Error loading image:', error);
        await this.hideLoading();
        return;
      }
    } else if (imageInput instanceof HTMLImageElement) {
      img = imageInput;
    } else {
      console.error('Invalid image input: must be a string (filename) or HTMLImageElement.');
      return;
    }

    // Check if the image is already loaded
    this.adjustCanvasDimensions(img);
    // if (img.complete) {
    //   ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // } else {
    //   // If the image is not loaded, wait for it to load
    //   img.onload = () => {
    //     ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    //   };
    // }
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    // Begin the path for the rounded rectangle
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    
    // Set the fill color with transparency
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill(); // Fill the rectangle

    // // Set the border color and draw the border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; // White with 30% transparency
    ctx.lineWidth = 3; // Set the border thickness
    ctx.stroke(); // Apply the border

    // Close the path
    ctx.closePath();
}



  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Adjusts the dimensions of the canvas based on the image dimensions.
   * @param img The image to adjust the canvas for.
   */
  private adjustCanvasDimensions(img: HTMLImageElement) {
    const imageWidth = img.naturalWidth;
    const imageHeight = img.naturalHeight;
    const ratio = imageWidth / imageHeight;

    // Internal size (full resolution of the image)
    this.canvas!.width = imageWidth;
    this.canvas!.height = imageHeight;

    // // Display size (necessary to guarantee it is zoomable) )
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowLandscape = (windowWidth / windowHeight) > 1;
    const margin = (windowWidth * 0.025);
    //const canvasWidth = windowWidth * 0.95;

    const canvasWidth = windowWidth - 2 * margin;
    const canvasHeight = canvasWidth / ratio;
    //const margin = 0;
    const marginTop = Math.max(0, (windowHeight - canvasHeight) / 2);

    console.log(`Container width: ${canvasWidth}`, 2);
    this.canvas!.style.width = `${canvasWidth}px`;
    this.canvas!.style.height = `${canvasHeight}px`;
    this.canvas!.style.marginLeft = `${margin}px`;
    this.canvas!.style.marginRight = `${margin}px`;
    this.canvas!.style.marginTop = `${marginTop}px`;
    this.canvas!.style.top = `${marginTop}px`;
    this.canvas!.style.marginBottom = `${margin}px`;
    this.canvas!.style.aspectRatio = `${ratio}/1`;

    // Reset any previous scaling of the contexta
    this.ctx!.setTransform(1, 0, 0, 1, 0, 0);

    // Scale the context to match the visual size of the canvas
    this.ctx!.scale(1, 1);

    // Draw the original image within the canvas scaled to the full internal size
    this.ctx!.drawImage(img, 0, 0, imageWidth, imageHeight);

    const radius = 20; // Adjust the border-radius
    const borderWidth = 10; // Adjust the width of the simulated border
    this.drawRoundedBorder(this.ctx!, 0, 0, imageWidth, imageHeight, radius, borderWidth);

    console.log(`Adjusted canvas dimensions: ratio=${ratio} width=${imageWidth}/${this.canvas!.style.width}, height=${imageHeight}/${this.canvas!.style.height}`, 2);
  }

  //////////////////////////////////////////////////////////////////////////////////////////////
  // Function to create a rounded rectangle with stroke for the border
  private drawRoundedBorder(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, borderWidth: number) {
    // Define the path for a rounded rectangle
    ctx.beginPath();
    ctx.globalAlpha = 0.5;
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();

    // Set the border (semi-transparent)
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = '#FFF'; // Semi-transparent green border
    ctx.stroke(); // Draw the border
    ctx.globalAlpha = 1.0;
    ctx.closePath();
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Increases the sensitivity by increasing the confidence slider value.
   */
  increaseSensitivity() {
    if (this.sensitivityValue < 5 ) {
      this.sensitivityValue++;
      this.updateSensitivity();
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Decreases the sensitivity by decreasing the confidence slider value.
   */
  decreaseSensitivity() {
    if (this.sensitivityValue > -5 ) {
      this.sensitivityValue--;
      this.updateSensitivity();
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Reset sensitivity to default value.
   */
  resetSensitivity() {
    if (this.sensitivityValue !== 0) {
      this.sensitivityValue=0;
      this.updateSensitivity(false);
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Updates the sensitivity based on the confidence slider value.
   */
  updateSensitivity(redraw: boolean=true) {
    this._sensitivityText = this.formatSensitivity(this.sensitivityValue);
    console.log(`Sensitivity updated: ${this.sensitivityValue}`, 2);

    this.calculateScoreThreshold(this.sensitivityValue);
    console.log(`Confidence threshold updated to: ${this.scoreThreshold}`, 2);

    this.isDecreaseDisabled = this.sensitivityValue <= -5;
    this.isIncreaseDisabled = this.sensitivityValue >= 5;
    if (this.ctx && redraw) {
      this.drawEllipses();
    }
  }


  //////////////////////////////////////////////////////////////////////////////////////////////
  // Function to format the pin label
  formatSensitivity(value: number): string {
    return value == 0 ? 'N' : value > 0 ? `+${value}` : `${value}`; // Add '+' to positive values, and show negative or zero values normally
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Calculates the confidence threshold based on the slider value.
   * @param newThreshold The new slider value.
    */
  private calculateScoreThreshold(newThreshold: number) {
    let lookupTable: { [key: string]: { scoreThreshold: number, iou: number } };

    if (this.fruitSubType === 'tree') {
      lookupTable = {
        "-5": { scoreThreshold: 0.90, iou: 0.10 },
        "-4": { scoreThreshold: 0.75, iou: 0.15 },
        "-3": { scoreThreshold: 0.50, iou: 0.25 },
        "-2": { scoreThreshold: 0.35, iou: 0.25 },
        "-1": { scoreThreshold: 0.25, iou: 0.25 },
        "0": { scoreThreshold: 0.15, iou: 0.35 },
        "1": { scoreThreshold: 0.12, iou: 0.35 },
        "2": { scoreThreshold: 0.10, iou: 0.35 },
        "3": { scoreThreshold: 0.08, iou: 0.40 },
        "4": { scoreThreshold: 0.06, iou: 0.45 },
        "5": { scoreThreshold: 0.02, iou: 0.45 }
      };
      console.log('Loaded profile for tree.');

    } else {
      //Default: soil
      lookupTable = {
        "-5": { scoreThreshold: 0.90, iou: 0.10 },
        "-4": { scoreThreshold: 0.80, iou: 0.15 },
        "-3": { scoreThreshold: 0.75, iou: 0.25 },
        "-2": { scoreThreshold: 0.50, iou: 0.25 },
        "-1": { scoreThreshold: 0.35, iou: 0.25 },
        "0": { scoreThreshold: 0.30, iou: 0.30 },
        "1": { scoreThreshold: 0.25, iou: 0.35 },
        "2": { scoreThreshold: 0.20, iou: 0.35 },
        "3": { scoreThreshold: 0.15, iou: 0.35 },
        "4": { scoreThreshold: 0.10, iou: 0.35 },
        "5": { scoreThreshold: 0.02, iou: 0.45 }
      };
      console.log('Loaded profile for soil.');
    };

    // Ensure newThreshold is within the valid range
    if (newThreshold >= -5 && newThreshold <= 5) {
      // Set scoreThreshold and iou based on the lookup table
      this.scoreThreshold = lookupTable![newThreshold].scoreThreshold;
      this.iouThreshold = lookupTable![newThreshold].iou;
    } else {
      console.error('Invalid newThreshold value. Must be between -5 and 5.');
    }
  }
  
  //////////////////////////////////////////////////////////////////////////////////////////////
  private splitFilename(full_filename: string): { filename: string; extension: string } {
    const lastDotIndex = full_filename.lastIndexOf('.');
  
    // If no dot is found, return the full filename as name and an empty extension
    if (lastDotIndex === -1) {
      return { filename: full_filename, extension: '' };
    }
  
    const filename = full_filename.substring(0, lastDotIndex);
    const extension = full_filename.substring(lastDotIndex + 1);
  
    return { filename: filename, extension: extension };
  }
  

  //////////////////////////////////////////////////////////////////////////////////////////////
  private enrichFilename(full_filename: string): string {
    let filename: string = '';
    let extension: string = '';
    ({filename, extension} = this.splitFilename(full_filename));
    const newFilename: string = `${filename}_count${this._totalSelectedObjects}_s${this.sensitivityValue}.${extension}`
    console.log(`New filename: ${newFilename}`, 2);
    return newFilename;
  }
  

//////////////////////////////////////////////////////////////////////////////////////////////

private blobToBase64(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Remove the data URL prefix to get only the base64 string
            const base64data = (reader.result as string).split(',')[1];
            resolve(base64data);
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsDataURL(blob);
    });
  }


  private downloadImage(dataUrl: string, filename: string): void {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      link.click();
  }


  /**
   * Presents a toast notification with a specified message and position.
   *
   * @param message - The message to display in the toast.
   * @param position - The position of the toast on the screen. Can be 'top', 'middle', or 'bottom'.
   * @returns A promise that resolves when the toast is presented.
   */
  async presentToast(
    message: string,
    position: 'top' | 'middle' | 'bottom'
  ): Promise<void> {
    const toastOptions: any = {
        message: message,
        position: position,
        cssClass: 'custom-toast'
    };

    const toast = await this.toastController.create(toastOptions);
    await toast.present();
  }



  // Methods for the numbers button
  holdNumbers() {
    this.showNumbers = false;
    this.updateIcon('button-numbers', 'icon_numbers_123_strike');
    this.drawEllipses(false);
  }

  releaseNumbers() {
    this.showNumbers = true;
    this.updateIcon('button-numbers', 'icon_numbers_123');
    this.drawEllipses(false);
  }

  // Methods for the circles button
  holdCircles() {
    this.showCircles = false;
    this.updateIcon('button-eye', 'icon_circles_strike');
    this.drawEllipses(false);
  }

  releaseCircles() {
    this.showCircles = true;
    this.updateIcon('button-eye', 'icon_circles');
    this.drawEllipses(false);
  }

  // Method to dynamically update the icon
  updateIcon(buttonClass: string, iconName: string) {
    const button = document.querySelector(`.${buttonClass}`) as HTMLElement;
    if (button) {
      button.style.backgroundImage = `url('assets/images/${iconName}.png')`;
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////////

  public async shareCanvasImage(platform: string = "auto"): Promise<void> {
    console.log('shareCanvasImage: platform=', platform);
    const dataUrl = this.getDataUrl(this.canvas!);
    const dataUrlOriginal = this.getDataUrl(this.originalImage!);
    const newFilename = this.enrichFilename(this.imageFilename);

    if (platform === "cloud") {
        // Llamada asíncrona a cloudUploadService sin detener el flujo principal
        this.storeResults(dataUrl, dataUrlOriginal, this.fruitType, this.fruitSubType, this.totalSelectedObjects, newFilename);
        // .then(() => {
        //     this.presentToast(`Imágenes y datos enviados a la nube con éxito.`, 'middle');
        // })
        // .catch((error) => {
        //     this.presentToast('¿Tiene conexión a internet? Puede seguir usando la aplicación normalmente, pero los resultados no se guardarán en la nube.', 'middle');
        // });

        // Hace el download para disco si esta en web browser
        if ( Capacitor.getPlatform() === 'web' ) {
          this.downloadImage(dataUrl, newFilename);
          this.presentToast(`Imagen "${newFilename}" guardada.`, 'top');
        }
    } 
    else if (platform === "social")
    {
      if ( Capacitor.getPlatform() === 'web' ) {
          this.downloadImage(dataUrl, newFilename);
          this.presentToast(`Imagen "${newFilename}" guardada.`, 'top');
      } else {
        //mobile
        try {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const base64Data = await this.blobToBase64(blob);

          const savedFile = await Filesystem.writeFile({
              path: newFilename,
              data: base64Data,
              directory: Directory.Cache
          });

          const fileUri = savedFile.uri;
          await Share.share({
              title: 'Compartir analisis de frutas',
              text: `${this.totalSelectedObjects} ${this.fruitName}!`,
              url: fileUri,
              dialogTitle: 'Compartir Imagen',
          });

          this.presentToast(`Imagen "${newFilename}" compartida.`, 'top');
        } catch (error) {
            console.error('Error al compartir la imagen:', error);
        }
      }
    }
  }

  public isUUIDv4(str: string): boolean {
    const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  return uuidv4Regex.test(str);
  }

  private extractGtNumber(filename: string): number {
    const match = filename.match(/_gt(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  public getDataUrl(element: HTMLCanvasElement | HTMLImageElement): string {
    return this.resizeImage(element).toDataURL('image/jpeg', 0.9);
  }

  public resizeImage(element: HTMLImageElement | HTMLCanvasElement, maxDimension: number = 2048): HTMLCanvasElement {
    const width = element instanceof HTMLCanvasElement ? element.width : element.naturalWidth;
    const height = element instanceof HTMLCanvasElement ? element.height : element.naturalHeight;

    // Verificar si la imagen ya está dentro del límite de tamaño
    if (width <= maxDimension && height <= maxDimension) {
        // Si ya es más pequeña, no se redimensiona
        const originalCanvas = document.createElement('canvas');
        originalCanvas.width = width;
        originalCanvas.height = height;
        const context = originalCanvas.getContext('2d');
        if (context) {
            context.drawImage(element, 0, 0);
        }
        return originalCanvas;
    }
    // Calcular nuevas dimensiones manteniendo el ratio
    const aspectRatio = width / height;
    let newWidth, newHeight;

    if (width > height) {
        newWidth = maxDimension;
        newHeight = Math.round(maxDimension / aspectRatio);
    } else {
        newHeight = maxDimension;
        newWidth = Math.round(maxDimension * aspectRatio);
    }

    // Crear un canvas redimensionado
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = newWidth;
    resizedCanvas.height = newHeight;
    const resizedContext = resizedCanvas.getContext('2d');
    if (resizedContext) {
        resizedContext.drawImage(element, 0, 0, newWidth, newHeight);
    }

    return resizedCanvas;
  }

  private mapFruitType(fruitName: string): string {
    const fruitMapping: { [key: string]: string } = {
      "apple-green": "MANZANA VERDE",
      "citrus-orange": "CITRUS NARANJA",
      "peach-red": "MELOCOTON ROJO/AMARILLO",
      "peach-yellow": "MELOCOTON AMARILLO"
    };
    return fruitMapping[fruitName] || fruitName;
  }

  private mapFruitSubType(fruitSubType: string): string {
    return fruitSubType === "tree" ? "ARBOL" : "SUELO";
  }

  public getFilenameWithoutExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    
    // If there's no dot, return the original filename
    if (lastDotIndex === -1) {
      return filename;
    }
    
    // Return the filename without the extension
    return filename.substring(0, lastDotIndex);
  }

  public async storeResults(dataUrl: string, dataUrlOriginal: string, fruitType: string, fruitSubType: string, totalSelectedObjects: number, currentFilename: string = "") : Promise<void> {
    try {
      let imageId = uuidv4();
      let corrected_quantities = 0;
      if (currentFilename !== "" && this.isUUIDv4(currentFilename)) {
        imageId = this.getFilenameWithoutExtension(currentFilename);
        corrected_quantities = this.extractGtNumber(currentFilename);
        if (corrected_quantities > 0)
          console.log('Corrected quantities:', corrected_quantities);
      }
      console.log('Image ID:', imageId);

      const base64Data = dataUrl.split(',')[1];
      const base64DataOriginal = dataUrlOriginal.split(',')[1];

      const weight = 0.1; // Peso promedio para el cálculo PRE
      const fruit = this.mapFruitType(fruitType);
      const type = this.mapFruitSubType(fruitSubType);

      const Url_base = "https://prod-agroseguro-fruit-counting-bucket.s3.amazonaws.com/images"
      const Url_result = `${Url_base}/results/${imageId}-result.jpg`;
      const Url_original = `${Url_base}/originals/${imageId}-original.jpg`;

      console.log('Going to mount API request...');
      let resultModel = new ResultData();
      resultModel.result_UUID = imageId;
      resultModel.result_image = base64Data;
      resultModel.original_image = base64DataOriginal;

      resultModel.fruit = fruit;
      resultModel.location = "Ubicación desconocida";
      resultModel.image_date = "2024-11-05";
      resultModel.weight = weight;
      resultModel.quantities = totalSelectedObjects;
      resultModel.pre_value = totalSelectedObjects * weight;
      resultModel.photo_type = type; // ARBOL/SUELO
      resultModel.small_fruits = 0;
      resultModel.medium_fruits = 0;
      resultModel.big_fruits = 0;

      resultModel.corrected_fruit_total_quantity = 0;
      resultModel.corrected_fruit_big_quantity = 0;
      resultModel.corrected_fruit_medium_quantity = 0;
      resultModel.corrected_fruit_small_quantity = 0;
      resultModel.url_original_image = Url_original;
      resultModel.url_result_image = Url_result;
      resultModel.mode = "offline"
  
      // Guardar en BD el analisis
      console.log('Saving new analisys on storage...');
      this.storageService.set(imageId, resultModel);
      console.log('Trying to send analisys...');
      this.uploaderService.uploadPreviousAnalyses('Uploading new analisys', false);
    } catch (error) {
      console.error('Error uploading images and data to the cloud:', error);
      throw new Error('Error uploading to the cloud.');
    }
  }
}
