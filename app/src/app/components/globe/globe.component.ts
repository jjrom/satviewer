import { Component, SecurityContext } from '@angular/core';
import { MatSliderModule } from '@angular/material/slider';
import * as THREE from 'three';
import Globe from 'globe.gl';
import * as satellite from 'satellite.js';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSnowflake, faClose } from '@fortawesome/free-solid-svg-icons';
import { SafePipe } from '../../pipes/safe.pipe';

@Component({
  selector: 'globe',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSliderModule,
    FontAwesomeModule,
    SafePipe
  ],
  templateUrl: './globe.component.html',
  styleUrl: './globe.component.css'
})
export class GlobeComponent {

  public frozen: boolean = false;
  public faSnowflake = faSnowflake;
  public faClose = faClose;

  public selected = null;

  public timeMultiplier = 500;

  public EARTH_RADIUS_KM = 6371; // km
  public SAT_SIZE = 200; // km
  public TIME_STEP = 1000.0 / 60.0; // per frame

  public inSitu = [];

  /*
   * Speed 2.0 => 30 seconds per orbit (at 60 fps)
   * So speed 60.0 => 1 second per orbit
   * Earth real speed is 86400 seconds per orbit
   * So earth real speed is (60 / 86400) * TIME_STEP multiplier
   */
  public AUTO_ROTATE_SPEED = (60.0 / 86400.0) * this.timeMultiplier;


  public satSpeed = this.TIME_STEP;

  public world;

  constructor() { }

  ngOnInit() {

    this.world = Globe();

    var el = document.getElementById('chart');
    
    if (el) {

      this.world(el)
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png');

      // Rotate globe
      this.world.controls().autoRotate = !this.frozen;
      this.world.controls().autoRotateSpeed = this.AUTO_ROTATE_SPEED;

      setTimeout(() => this.world.pointOfView({ altitude: 3.5 }));

      this.fetchSatellites();
      this.fetchInSitu();
      this.fetchInfra();

    }

  }

  public freeze() {

    this.frozen = !this.frozen;

    if (this.frozen) {
      this.world.controls().autoRotate = false;
      this.satSpeed = 0;
    }
    else {
      this.world.controls().autoRotate = true;
      this.satSpeed = this.TIME_STEP;
    }

  }

  public unselect() {
    this.selected = null;
  }


  private fetchInSitu() {

    var self = this;

    var urls = [
      'assets/data/insitu/insitu_pf_latest.json', 
      'assets/data/insitu/insitu_sd.json',
      'assets/data/insitu/insitu_sm.json',
      'assets/data/insitu/insitu_tg.json'
    ];

    var arr;

    Promise.all(
      urls.map(url =>
          fetch(url)
              .then(e => e.json())
          )
      ).then(data => {
          arr = data.flat();
          self.inSitu = self.sampleArray(arr, 3);
          self.world
            .pointsData(self.inSitu)
            .pointLat(d => d.coords.lats[0])
            .pointLng(d => d.coords.lons[0])
            .pointAltitude(0)
            .pointLabel(d => d.id)
            .pointColor(d => self.getInSituColor(d.type))
            
            // Random beep on inSitu data
            self.startBeeper();
          }
      );
      
  }

  /**
   * Return a sample of array (i.e. one element every factor step)
   * @param arr array
   * @param factor factor reduction
   */
  private sampleArray(arr, factor) {

    var samples = [];
    for (var i = 0, ii = arr.length; i < ii; i = i + factor) {
      if (arr[i]) {
        samples.push(arr[i]);
      }
    }
    return samples;
  }

  private fetchInfra() {

    /*
    var beepers = this.getBeepers(10);
    const colorInterpolator = t => `rgba(255, 255, 50, ${Math.sqrt(1 - t)})`;

    // In situ data
    self.world
      .ringsData(beepers)
      .ringColor(() => colorInterpolator)
      .ringMaxRadius('maxR')
      .ringPropagationSpeed('propagationSpeed')
      .ringRepeatPeriod('repeatPeriod')

      .labelsData(beepers)
      .labelLat(d => d.lat)
      .labelLng(d => d.lng)
      .labelText(d => 'inSitu')
      //.labelSize(d => Math.sqrt(d.properties.pop_max) * 4e-4)
      .labelDotRadius(d => 0.5)
      .labelColor(() => 'rgba(255, 165, 0, 0.75)')
      .labelResolution(2)
      .onLabelClick(function (obj) {
        self.selected = {
          type:"insitu",
          properties:obj
        }
      });
*/
  }

  private fetchSatellites() {

    var self = this;
    var timeLogger = document.getElementById('time_logger');

    const satGeometry = new THREE.OctahedronGeometry(this.SAT_SIZE * this.world.getGlobeRadius() / this.EARTH_RADIUS_KM / 2, 0);
    const satMaterial = new THREE.MeshLambertMaterial({ color: 'white', transparent: true, opacity: 0.7 });

    // Satellites
    self.world
      .objectLat('lat')
      .objectLng('lng')
      .objectAltitude('alt')
      .objectFacesSurface(false)
      .objectLabel('name')
      .onObjectClick(function (obj) {
        self.selected = {
          type:"sat",
          properties:obj
        };
      });

    self.world.objectThreeObject(() => new THREE.Mesh(satGeometry, satMaterial));

    fetch('assets/data/space-track-leo-subset.txt')
        .then(
          r => r.text()
        )
        .then(
          rawData => {
            const tleData = rawData.replace(/\r/g, '')
              .split(/\n(?=[^12])/)
              .filter(d => d)
              .map(tle => tle.split('\n'));
            const satData = tleData.map(
              ([name, ...tle]) => {
                let cleanName = name.trim().replace(/^0 /, '')
                return {
                  //@ts-ignore
                  satrec: satellite.twoline2satrec(...tle),
                  name: cleanName,
                  lat: 0,
                  lng: 0,
                  alt: 0,
                  infoUrl: self.getInfoUrl(cleanName)
                }
              }
            )
              // exclude those that can't be propagated
              .filter(d => !!satellite.propagate(d.satrec, new Date()).position)
              .slice(0, 2000);

            // time ticker
            let time = new Date();

            (function frameTicker() {
              requestAnimationFrame(frameTicker);

              time = new Date(+time + (self.satSpeed * self.timeMultiplier));
              timeLogger.innerText = time.toUTCString();

              // Update satellite positions
              const gmst = satellite.gstime(time);
              satData.forEach(d => {
                const eci = satellite.propagate(d.satrec, time);
                if (typeof eci.position !== 'boolean' && eci.position) {
                  const gdPos = satellite.eciToGeodetic(eci.position, gmst);
                  d.lat = gdPos.latitude * 180 / Math.PI;
                  d.lng = gdPos.longitude * 180 / Math.PI;
                  d.alt = gdPos.height / self.EARTH_RADIUS_KM;
                }
              });

              self.world.objectsData(satData);

            })();

          }
        );
  }

  private getInSituColor(type) {

    switch (type) {
      case 'SM':
        return 'pink';

      case 'SD':
        return 'blue';

      case 'TG':
        return 'purple';

      case 'PF':
          return 'orange';

      default:
        return 'gray';
    }

  }

  private startBeeper() {

    var self = this;

    if (this.inSitu && this.inSitu.length > 0) {

      setInterval(() => {
        var item, beeps = [];
        for (var i = 10; i--;) {
          item = self.inSitu[Math.floor(Math.random() * self.inSitu.length)];
          beeps.push({
            lat: item.coords.lats[0],
            lng: item.coords.lons[0],
            color: self.getInSituColor(item.type),
            maxR: Math.random() * 5 + 3,
            propagationSpeed: (Math.random() - 0.5) * 20 + 1,
            repeatPeriod: Math.random() * 2000 + 200
          });
        }

        self.world
          .ringsData(beeps)
          .ringColor(d => d.color)
          .ringMaxRadius('maxR')
          .ringPropagationSpeed('propagationSpeed')
          .ringRepeatPeriod('repeatPeriod')

      }, 3000);

      

    }

  }

  private getInfoUrl(name) {

    switch (name) {

      case 'Sentinel-1A':
      case 'Sentinel-1B':
        return'https://en.wikipedia.org/wiki/Sentinel-1';
        
      case 'Sentinel-2A':
      case 'Sentinel-2B':
        return 'https://en.wikipedia.org/wiki/Sentinel-2';
        
      case 'Sentinel-3A':
      case 'Sentinel-3B':
        return 'https://en.wikipedia.org/wiki/Sentinel-3';
      
      case 'Sentinel-6MF':
        return 'https://en.wikipedia.org/wiki/Sentinel-6_Michael_Freilich';
      
      case 'Suomi-NPP':
        return 'https://en.wikipedia.org/wiki/Suomi_NPP';

      case 'METOP-B':
      case 'METOP-C':
        return 'https://en.wikipedia.org/wiki/MetOp';
  
      default:
        return 'https://en.wikipedia.org/wiki/' + name;
    }

  }

}