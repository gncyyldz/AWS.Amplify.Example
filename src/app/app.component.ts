import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FaceDetectionComponent } from './face-detection/face-detection.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FaceDetectionComponent],
  template: `
  <div class="app-container">
    <h1>Yüz Tanıma Uygulaması</h1>
    <app-face-detection></app-face-detection>
  </div>
  `,
  styles: `
  .app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  
  h1 {
    text-align: center;
    color: #333;
    margin-bottom: 30px;
    font-size: 2em;
  }
} 
  `
})
export class AppComponent {
  title = 'AWS.Amplify.Example';
}

