declare module 'piexifjs' {
    export function load(data: string): any;
    export function dump(data: any): string;
    export function insert(exif: string, data: string): string;
    export function remove(data: string): string;
}
