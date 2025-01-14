import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as faceapi from 'face-api.js';

interface FaceFeatures {
  image: string;
  leftEye?: string;
  rightEye?: string;
  nose?: string;
  mouth?: string;
  faceId?: string;
  descriptor?: Float32Array;
}

interface FaceGroup {
  faceId: string;
  captures: FaceFeatures[];
}

@Component({
  selector: 'app-face-detection',
  templateUrl: './face-detection.component.html',
  styleUrls: ['./face-detection.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class FaceDetectionComponent implements OnInit {
  @ViewChild('video') videoElement!: ElementRef;
  @ViewChild('canvas') canvasElement!: ElementRef;
  
  capturedFaces: FaceFeatures[] = [];
  groupedFaces: FaceGroup[] = [];
  loading: number = 0;
  private stream: MediaStream | null = null;
  private faceCaptureCounts: Map<string, number> = new Map();
  private readonly CAPTURES_PER_FACE = 3;

  async ngOnInit() {
    await this.loadModels();
    await this.startVideo();
    this.detectFaces();
  }

  async loadModels() {
    try {
      console.log('Model yükleme başladı...');
      const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
      
      await Promise.all([
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
      ]);
      
      console.log('Modeller başarıyla yüklendi');
    } catch (error) {
      console.error('Model yükleme hatası:', error);
      throw new Error('Modeller yüklenemedi. Lütfen sayfayı yenileyin.');
    }
  }

  async startVideo() {
    this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
    this.videoElement.nativeElement.srcObject = this.stream;
  }

  private extractFeature(canvas: HTMLCanvasElement, points: any[], padding: number = 10): string {
    try {
      const minX = Math.max(0, Math.min(...points.map(p => p.x)) - padding);
      const maxX = Math.min(canvas.width, Math.max(...points.map(p => p.x)) + padding);
      const minY = Math.max(0, Math.min(...points.map(p => p.y)) - padding);
      const maxY = Math.min(canvas.height, Math.max(...points.map(p => p.y)) + padding);

      const width = maxX - minX;
      const height = maxY - minY;

      if (width <= 0 || height <= 0) {
        throw new Error('Geçersiz boyut');
      }

      const featureCanvas = document.createElement('canvas');
      featureCanvas.width = width;
      featureCanvas.height = height;
      const ctx = featureCanvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(
          canvas,
          minX, minY, width, height,
          0, 0, width, height
        );
      }

      return featureCanvas.toDataURL('image/jpeg');
    } catch (error) {
      console.error('Feature extraction error:', error);
      return '';
    }
  }

  private async isSameFace(detection1: any, detection2: any): Promise<boolean> {
    try {
      const descriptor1 = detection1.descriptor;
      const descriptor2 = detection2.descriptor;
      
      if (!descriptor1 || !descriptor2) return false;
      
      const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
      return distance < 0.6;
    } catch (error) {
      console.error('Yüz karşılaştırma hatası:', error);
      return false;
    }
  }

  private generateFaceId(detection: any): string {
    const landmarks = detection.landmarks.positions;
    return landmarks.reduce((acc: string, point: any) => 
      acc + point.x.toFixed(2) + point.y.toFixed(2), '');
  }

  private updateGroupedFaces() {
    const groups = new Map<string, FaceFeatures[]>();
    
    this.capturedFaces.forEach(face => {
      if (face.faceId) {
        if (!groups.has(face.faceId)) {
          groups.set(face.faceId, []);
        }
        groups.get(face.faceId)?.push(face);
      }
    });

    this.groupedFaces = Array.from(groups.entries()).map(([faceId, captures]) => ({
      faceId,
      captures
    }));
  }

  async detectFaces() {
    const drawFace = async () => {
      const detections = await faceapi
        .detectSingleFace(this.videoElement.nativeElement)
        .withFaceLandmarks();

      const canvas = this.canvasElement.nativeElement;
      const displaySize = { 
        width: this.videoElement.nativeElement.width, 
        height: this.videoElement.nativeElement.height 
      };
      
      faceapi.matchDimensions(canvas, displaySize);
      
      if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'rgba(48, 255, 48, 0.8)';
        ctx.shadowColor = '#30ff30';
        ctx.shadowBlur = 3;
        
        const landmarks = resizedDetections.landmarks;
        const points = landmarks.positions;
        
        points.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        });

        points.forEach((point, i) => {
          if (i < points.length - 1) {
            const nextPoint = points[i + 1];
            const distance = Math.sqrt(
              Math.pow(nextPoint.x - point.x, 2) + 
              Math.pow(nextPoint.y - point.y, 2)
            );
            
            if (distance < 30) {
              const steps = 3;
              for (let j = 1; j < steps; j++) {
                const x = point.x + (nextPoint.x - point.x) * (j / steps);
                const y = point.y + (nextPoint.y - point.y) * (j / steps);
                
                const offsetX = (Math.random() - 0.5) * 2;
                const offsetY = (Math.random() - 0.5) * 2;
                
                ctx.beginPath();
                ctx.arc(x + offsetX, y + offsetY, 0.8, 0, 2 * Math.PI);
                ctx.fill();
              }
            }
          }
        });

        const addRandomPoints = (centerX: number, centerY: number, radius: number, count: number) => {
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const r = Math.random() * radius;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            
            ctx.beginPath();
            ctx.arc(x, y, 0.5, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(48, 255, 48, ${Math.random() * 0.5 + 0.3})`;
            ctx.fill();
          }
        };

        const centerPoint = points[30];
        addRandomPoints(centerPoint.x, centerPoint.y, 100, 100);
      } else {
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    const animate = () => {
      drawFace();
      requestAnimationFrame(animate);
    };
    animate();

    const MAX_FACES = 3;
    const captureInterval = setInterval(async () => {
      if (this.capturedFaces.length >= MAX_FACES) {
        clearInterval(captureInterval);
        console.log('Maksimum yüz sayısına ulaşıldı!');
        return;
      }

      const detection = await faceapi
        .detectSingleFace(this.videoElement.nativeElement)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const SIMILARITY_THRESHOLD = 0.4;
        let isNewFace = true;

        for (const face of this.capturedFaces) {
          if (face.descriptor) {
            const distance = faceapi.euclideanDistance(
              face.descriptor,
              detection.descriptor
            );
            
            if (distance < SIMILARITY_THRESHOLD) {
              isNewFace = false;
              break;
            }
          }
        }

        if (isNewFace && this.capturedFaces.length < MAX_FACES) {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          const box = detection.detection.box;
          const padding = {
            width: box.width * 0.5,
            height: box.height * 0.5
          };

          const cropArea = {
            x: Math.max(0, box.x - padding.width),
            y: Math.max(0, box.y - padding.height),
            width: Math.min(box.width + (padding.width * 2), this.videoElement.nativeElement.width - box.x),
            height: Math.min(box.height + (padding.height * 2), this.videoElement.nativeElement.height - box.y)
          };

          canvas.width = cropArea.width;
          canvas.height = cropArea.height;
          
          context?.drawImage(
            this.videoElement.nativeElement,
            cropArea.x, cropArea.y,
            cropArea.width, cropArea.height,
            0, 0,
            cropArea.width, cropArea.height
          );

          const landmarks = detection.landmarks;
          const adjustedLandmarks = {
            getLeftEye: () => landmarks.getLeftEye().map(p => ({
              x: p.x - cropArea.x,
              y: p.y - cropArea.y
            })),
            getRightEye: () => landmarks.getRightEye().map(p => ({
              x: p.x - cropArea.x,
              y: p.y - cropArea.y
            })),
            getNose: () => landmarks.getNose().map(p => ({
              x: p.x - cropArea.x,
              y: p.y - cropArea.y
            })),
            getMouth: () => landmarks.getMouth().map(p => ({
              x: p.x - cropArea.x,
              y: p.y - cropArea.y
            }))
          };

          const features: FaceFeatures = {
            image: canvas.toDataURL('image/jpeg'),
            leftEye: this.extractFeature(canvas, adjustedLandmarks.getLeftEye(), 15),
            rightEye: this.extractFeature(canvas, adjustedLandmarks.getRightEye(), 15),
            nose: this.extractFeature(canvas, adjustedLandmarks.getNose(), 15),
            mouth: this.extractFeature(canvas, adjustedLandmarks.getMouth(), 15),
            descriptor: detection.descriptor
          };

          this.capturedFaces.push(features);
          
          this.loading = (this.capturedFaces.length / MAX_FACES) * 100;

          if (this.capturedFaces.length >= MAX_FACES) {
            clearInterval(captureInterval);
            console.log('Maksimum yüz sayısına ulaşıldı!');
          }
        }
      }
    }, 2000);
  }

  ngOnDestroy() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }
} 