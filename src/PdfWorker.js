import { GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker?url';

GlobalWorkerOptions.workerSrc = workerUrl;