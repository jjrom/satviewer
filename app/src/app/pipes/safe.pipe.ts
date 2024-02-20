import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer} from '@angular/platform-browser';

@Pipe({
  name: 'safe',
  standalone: true
})
export class SafePipe implements PipeTransform {
  constructor(private domSanitizer: DomSanitizer) {}
  transform(url): unknown {
    //return this.domSanitizer.sanitize(SecurityContext.URL, url);
    return this.domSanitizer.bypassSecurityTrustResourceUrl(url);
  }

}
