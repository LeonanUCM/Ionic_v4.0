// src/app/services/cloud-upload.service.ts
import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root'
})
export class CloudUploadService {
  private Url: string = "";
  private signInUrl: string = "";
  private refreshTokenUrl: string = "";
  private photoUploadUrl: string = "";
  private dataUploadUrl: string = "";
  private userId = '';
  private token = '';
  private refreshToken = '';

  constructor() {
  }

  public setUrl(url: string) {
    console.log(`CloudUploadService initialized with URL: ${url}`);
    this.Url = url;
    this.signInUrl = this.Url + 'auth/sign-in';
    this.refreshTokenUrl =  this.Url + 'auth/refresh-token';
    this.photoUploadUrl =  this.Url + 'photo';
    this.dataUploadUrl = this.Url + 'photo/data';
  }

  // Sign in
  private async signInRequest() {
    try {
        const response = await fetch(this.signInUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "email": "Leonan.Vasconcelos@newtoms.com",
                "password": "leonaN12345",
                "admin": false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to sign in: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const response_data = await response.json();
        console.log('SignIn response:', response_data);
        this.userId = response_data.data.session_data.userId;
        this.token = response_data.data.session_data.token;
        this.refreshToken = response_data.data.session_data.refreshToken;
    } catch (error) {
        console.error('Error en signInRequest:', error);
        throw error; // Re-lanzar el error para que pueda ser capturado en otro lugar si es necesario
    }
  }

  // Refresh token
  private async refreshTokenRequest() {
    try {
        const response = await fetch(this.refreshTokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'user_id': this.userId
            },
            body: JSON.stringify({ "refresh_token": this.refreshToken })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to refresh token: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const response_data = await response.json();
        console.log('RefreshToken response:', response_data);
        this.token = response_data.data.token;
        this.refreshToken = response_data.data.refresh_token;
        console.log('new this.token:', this.token);
    } catch (error) {
        console.error('Error en refreshTokenRequest:', error);
        throw error; // Re-lanzar el error para que pueda ser capturado en otro lugar si es necesario
    }
  }

  // Upload image
  private async uploadImage(imageId: string, base64Data: string, result: boolean): Promise<void> {
    try {
        const response = await fetch(this.photoUploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.token
        },
        body: JSON.stringify({
          'name': imageId,
          'file': base64Data,
          'result': result
        })
      });
      console.log('Request Photo { name:', imageId, 'result:', result, '}');
      console.log('Response Photo:', response);
    
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload image: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log('Imagen subida exitosamente.');
    } catch (error) {
      console.error('Error en uploadImage:', error);
      throw error; // Re-lanzar el error para que pueda ser capturado en performUpload
    }
  }

  private resizeImage(element: HTMLImageElement | HTMLCanvasElement, maxDimension: number = 2048): HTMLCanvasElement {
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

  // Upload analysis data
  public async uploadToCloud(dataUrl: string, dataUrlOriginal: string, fruitType: string, fruitSubType: string, totalSelectedObjects: number, currentFilename: string = ""): Promise<void> {
    try {
      let imageId = uuidv4();
      let corrected_quantities = 0;
      if (currentFilename !== "" && this.isUUIDv4(currentFilename)) {
        imageId = currentFilename;
        corrected_quantities = this.extractGtNumber(currentFilename);
        if (corrected_quantities > 0)
          console.log('Corrected quantities:', corrected_quantities);
      }
      console.log('Image ID:', imageId);

      const base64Data = dataUrl.split(',')[1];
      const base64DataOriginal = dataUrlOriginal.split(',')[1];

      // Hace login si ho hay token (primera vez)
      if ( this.userId === '' || this.token === '' || this.refreshToken === '' ) {
        await this.signInRequest();
      }

      try 
      {
        // Intentar subir la imagen original por primera vez
        await this.uploadImage(imageId, base64DataOriginal, false);
        console.log('Imagen original subida exitosamente en el primer intento.');
      } 
      catch (uploadError) 
      {
        console.warn('Falla al subir la imagen original, a intentar hacer refresh de token:', uploadError);
    
        try {
          // Intentar refrescar el token
          await this.refreshTokenRequest();
          console.log('Token refrescado exitosamente.');
    
          try {
            // Intentar subir la imagen nuevamente después de refrescar el token
            await this.uploadImage(imageId, base64DataOriginal, false);
            console.log('Imagen original subida exitosamente después de refrescar el token.');
          } catch (secondUploadError) {
            console.warn('Falla al subir la imagen original después de refrescar el token:', secondUploadError);
            throw new Error('Falla al subir la imagen original después de refrescar el token.');
          }
    
        } catch (refreshError) {
          console.warn('Error al refrescar el token:', refreshError);
          throw new Error('Falla al refrescar el token.');
        }
      }
      
      try {
        await this.uploadImage(imageId, base64Data, true);  // Edited image
      }
      catch (error) {
        console.error('Error uploading edited image to the cloud:', error);
        throw new Error('Falla al subir la imagen resultado.');
      }
      

      // Step 3: Upload analysis data
      const weight = 10; // Peso promedio para el cálculo PRE
      const fruit = this.mapFruitType(fruitType);
      const type = this.mapFruitSubType(fruitSubType);

      const analysisData = [
        {
          "fruit": fruit,  // Tipo de fruta de la imagen
          "location": "Madrid, Sanchinarro",  // Ubicación de origen de la imagen
          "image_date": "2024-11-05",  // Fecha de origen de la imagen
          "weight": weight,  // Peso promedio para el cálculo PRE
          "quantities": totalSelectedObjects,  // Cantidad total de frutos en la imagen
          "pre_value": totalSelectedObjects * weight,  // Resultado de la operación (weight * quantities)
          "small_fruits": 0,  // Cantidad de frutos pequeños
          "medium_fruits": 0,  // Cantidad de frutos medianos
          "big_fruits": 0,  // Cantidad de frutos grandes
          "url": `https://prod-agroseguro-fruit-counting-bucket.s3.amazonaws.com/images/results/${imageId}.jpg`,  // URL de la imagen resultante
          "original_url": `https://prod-agroseguro-fruit-counting-bucket.s3.amazonaws.com/images/originals/${imageId}.jpg`,  // URL de la imagen original
          "type": type, // puede ser: ARBOL o SUELO
          "hidden_fruits": 0,  // Cantidad de frutos ocultos
          "corrected_quantities": corrected_quantities,  // Cantidad total de frutos corregido manualmente
          "mode": "offline"
        }
      ];

      console.log('Request: POST /photo/data', analysisData);
      const response = await fetch(this.dataUploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.token
        },
        body: JSON.stringify(analysisData)
      });
      console.log('Response: POST /photo/data', response);

    } catch (error) {
      console.error('Error uploading images and data to the cloud:', error);
      throw new Error('Error uploading to the cloud.');
    }
  }

  // Helper functions
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


}
