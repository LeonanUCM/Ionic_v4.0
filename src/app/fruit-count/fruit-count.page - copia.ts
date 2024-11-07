import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import * as tf from '@tensorflow/tfjs';

@Component({
  selector: 'app-fruit-count',
  templateUrl: './fruit-count.page.html',
  styleUrls: ['./fruit-count.page.scss'],
})
export class FruitCountPage implements OnInit, AfterViewInit {
  model: tf.GraphModel | null = null;
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  canvasContainer: HTMLElement | null = null;
  imageOriginal: HTMLImageElement | null = null;
  ellipses: any[] = [];
  confidence_threshold: number = 5;
  confidenceSlider: number = 5;  
  thresholdValue: number = 5;    
  predictionsData: any[] = [];
  totalObjects: number = 0;
  model_name: string = './assets/models/apple-green-model_js/model.json';
  fruitType: string = '';

  constructor(private route: ActivatedRoute, private navCtrl: NavController) {}
  
  goBack() {
    this.navCtrl.back(); // Regresa a la página anterior
  }
  
  async ngOnInit() {
    await this.loadModel();
    this.route.queryParams.subscribe(params => {
      this.fruitType = params['fruit_type'];  // Captura el parámetro fruit_type
    });    
  }

  ngAfterViewInit() {
    this.initializeEventListeners();
  }

  async loadModel() {
    if (this.model !== null) {
      console.log('Model already loaded. Skipping re-load.');
      return;
    }

    this.showLoading(true, 'Loading model...');
    try {
      this.model = await tf.loadGraphModel(this.model_name);
      console.log('Model loaded successfully.');
    } catch (error) {
      console.error('Error loading the model:', error);
      alert('Error loading the model. Check the console for more details.');
    } finally {
      this.showLoading(false, '');
    }
  }

  initializeEventListeners() {
    document.getElementById('imageUpload')?.addEventListener('change', this.handleImageUpload.bind(this));
    document.getElementById('cameraUpload')?.addEventListener('change', this.handleImageUpload.bind(this));
    document.getElementById('confidenceSlider')?.addEventListener('input', this.handleSliderChange.bind(this));

    this.confidence_threshold = this.calcConfidenceThreshold(this.confidence_threshold);
    this.canvas = document.getElementById('resultCanvas') as HTMLCanvasElement;
    this.canvasContainer = document.getElementById('canvasContainer')!;
    this.drawImageRounded(this.canvas, '../../../assets/images/icon-manzana-verde.png');
  }

  showLoading(show: boolean, message: string) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const statusMessage = document.getElementById('statusMessage');
    if (loadingOverlay && statusMessage) {
      if (show) {
        loadingOverlay.classList.remove('hidden');
        statusMessage.textContent = message;
      } else {
        loadingOverlay.classList.add('hidden');
      }
    }
  }

  async handleImageUpload(event: any) {
    this.showLoading(true, 'Loading image...');
    try {
      const file = event.target.files[0];
      console.log(`Selected image file: ${file.name}`);

      this.canvas = document.getElementById('resultCanvas') as HTMLCanvasElement;
      this.ctx = this.canvas.getContext('2d')!;
      const img = new Image();

      // Clear previous predictions and count
      this.predictionsData.length = 0;
      this.totalObjects = 0;

      img.src = URL.createObjectURL(file);
      img.onload = async () => {
        const inputTensor = this.imageToTensor(img);
        this.showLoading(true, 'Detecting objects...');

        let final_boxes: tf.Tensor | undefined, final_scores: tf.Tensor | undefined;
        try {
          const result = await this.predict(inputTensor);
          if (!result || !result.final_boxes || !result.final_scores) {
            throw new Error('No results received from prediction.');
          }

          final_boxes = result.final_boxes;
          final_scores = result.final_scores;

          console.log(`Number of detected objects: ${final_boxes.shape[0]}`);
        } catch (error) {
          console.error('Error during prediction:', error);
        } finally {
          tf.dispose([inputTensor]);
        }

        this.imageOriginal = img;
        const canvasWidth = this.adjustCanvasDimensions(img);
        const scaleX = canvasWidth / 640;
        const scaleY = this.canvas!.height / 640;

        if (final_boxes && final_scores) {
          this.ellipses = await this.tensorToEllipses(final_boxes, final_scores, scaleX, scaleY);
          this.totalObjects = this.drawEllipses(this.ctx!, this.ellipses, this.canvas!.width, this.canvas!.height, this.confidence_threshold);
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
    this.ctx = this.canvas.getContext('2d')!;

    this.confidence_threshold = this.calcConfidenceThreshold(parseInt(event.target.value));
    console.log(`Confidence threshold updated: ${this.confidence_threshold}`);

    this.totalObjects = this.drawEllipses(this.ctx, this.ellipses, this.canvas.width, this.canvas.height, this.confidence_threshold);
  }

  calcConfidenceThreshold(newThreshold: number): number {
    return Math.round(103 - newThreshold * 10) / 100;
  }

  imageToTensor(img: HTMLImageElement): tf.Tensor {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 640;
    tempCanvas.height = 640;
    const ctxTemp = tempCanvas.getContext('2d')!;
    ctxTemp.drawImage(img, 0, 0, 640, 640);
    const imageData = ctxTemp.getImageData(0, 0, 640, 640);
    return tf.browser.fromPixels(imageData).toFloat().div(255.0);
  }

  async predict(inputTensor: tf.Tensor) {
    if (!this.model) {
      console.error('Model is not loaded.');
      return;
    }

    const batchedInput = inputTensor.expandDims(0);
    const outputs = await this.model.executeAsync(batchedInput);
    const predictions = Array.isArray(outputs) ? outputs[0].squeeze().transpose() : outputs.squeeze().transpose();
    const boxes = predictions.slice([0, 0], [-1, 4]);
    const scores = predictions.slice([0, 4], [-1, 1]).squeeze();

    const mask = scores.greaterEqual(this.confidence_threshold);
    const filtered_boxes = await tf.booleanMaskAsync(boxes, mask);
    const filtered_scores = await tf.booleanMaskAsync(scores, mask);

    return { final_boxes: filtered_boxes, final_scores: filtered_scores };
  }

  async tensorToEllipses(final_boxes: tf.Tensor, final_scores: tf.Tensor, scaleX: number, scaleY: number) {
    const boxes_array = await final_boxes.array();
    const scores_array = await final_scores.array();

    const predictions_array = (boxes_array as number[][]).map((box: number[], idx: number) => ({
      box,
      score: (scores_array as number[])[idx],
    }));

    predictions_array.sort((a, b) => {
      const a_y_center = a.box[1];
      const b_y_center = b.box[1];
      return a_y_center - b_y_center;
    });

    return predictions_array.map((pred: any, index: number) => {
      const box = pred.box;
      const x1 = box[0] * scaleX;
      const y1 = box[1] * scaleY;
      const x2 = box[2] * scaleX;
      const y2 = box[3] * scaleY;

      return { centerX: (x1 + x2) / 2, centerY: (y1 + y2) / 2, radiusX: (x2 - x1) / 2, radiusY: (y2 - y1) / 2, index, score: pred.score };
    });
  }

  adjustCanvasDimensions(img: HTMLImageElement) {
    const imageWidth = img.naturalWidth;
    const imageHeight = img.naturalHeight;

    const maxCanvasWidth = window.innerWidth * 0.8;
    const maxCanvasHeight = window.innerHeight * 0.8;

    const widthRatio = maxCanvasWidth / imageWidth;
    const heightRatio = maxCanvasHeight / imageHeight;
    const scaleRatio = Math.min(widthRatio, heightRatio);

    const canvasWidth = imageWidth * scaleRatio;
    const canvasHeight = imageHeight * scaleRatio;

    this.canvas!.width = canvasWidth;
    this.canvas!.height = canvasHeight;

    return canvasWidth;
  }

  drawEllipses(ctx: CanvasRenderingContext2D, ellipses: any[], canvasWidth: number, canvasHeight: number, threshold: number) {
    let total = 0;

    ellipses.forEach(({ centerX, centerY, radiusX, radiusY, index, score }) => {
      if (score > threshold) {
        ctx.beginPath();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2.5;
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.closePath();
        total++;
      }
    });

    return total;
  }

  drawImageRounded(canvas: HTMLCanvasElement, imgSrc: string) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Canvas context is not available.');
      return;
    }

    const img = new Image();
    img.src = imgSrc;

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#332007';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(canvas.width - 20, 0);
      ctx.quadraticCurveTo(canvas.width, 0, canvas.width, 20);
      ctx.lineTo(canvas.width, canvas.height - 20);
      ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - 20, canvas.height);
      ctx.lineTo(20, canvas.height);
      ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - 20);
      ctx.lineTo(0, 20);
      ctx.quadraticCurveTo(0, 0, 20, 0);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
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
  }
}
