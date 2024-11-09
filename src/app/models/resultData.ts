/**
 * Representa el resultado de un análisis de imagen.
 *
 * @property {string} result_UUID - Identificador UUID del análisis.
 * @property {string} original_image - Imagen original en formato base64.
 * @property {string} result_image - Imagen procesada resultante en formato base64.
 * @property {string} fruit - Tipo de fruta de la imagen.
 * @property {string} location - Ubicación de origen de la imagen.
 * @property {string} image_date - Fecha de origen de la imagen.
 * @property {string} url_original_image - URL en la que se guarda la imagen original.
 * @property {string} url_result_image - URL en la que se guarda la imagen resultante.
 * @property {number} weight - Peso promedio utilizado para el cálculo PRE.
 * @property {number} quantities - Cantidad total de frutos en la imagen.
 * @property {number} pre_value - Resultado de la operación (weight * quantities).
 * @property {number} photo_type - Tipo de ambiente de imagen, ARBOL o SUELO.
 * @property {number} small_fruits - Cantidad de frutos pequeños en la imagen.
 * @property {number} medium_fruits - Cantidad de frutos medianos en la imagen.
 * @property {number} big_fruits - Cantidad de frutos grandes en la imagen.
 * @property {number} corrected_fruit_total_quantity - Cantidad de frutos totales corregido manualmente.
 * @property {number} corrected_fruit_small_quantity - Cantidad de frutos pequeños corregido manualmente.
 * @property {number} corrected_fruit_medium_quantity - Cantidad de frutos medianos corregido manualmente.
 * @property {number} corrected_fruit_big_quantity - Cantidad de frutos grandes corregido manualmente.
 */
export class ResultData {
  result_UUID: string;
  original_image: string;
  result_image: string;
  fruit: string;
  location: string;
  image_date: string;
  url_original_image: string;
  url_result_image: string;
  weight: number;
  quantities: number;
  pre_value: number;
  photo_type: string;
  small_fruits: number;
  medium_fruits: number;
  big_fruits: number;
  corrected_fruit_total_quantity: number;
  corrected_fruit_small_quantity: number;
  corrected_fruit_medium_quantity: number;
  corrected_fruit_big_quantity: number;
  mode: string;
}
