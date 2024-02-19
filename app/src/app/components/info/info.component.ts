import { Component, Input } from '@angular/core';

@Component({
  selector: 'info',
  standalone: true,
  imports: [],
  templateUrl: './info.component.html',
  styleUrl: './info.component.css'
})
export class InfoComponent {

  @Input() obj: object = {};

}
