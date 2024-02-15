import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobeComponent } from './components/globe/globe.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    GlobeComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'app';
}
