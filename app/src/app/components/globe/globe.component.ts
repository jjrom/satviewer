import { Component } from '@angular/core';
import { MatSliderModule } from '@angular/material/slider';
import * as THREE from 'three';
import * as d3 from 'd3';
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

  public timeMultiplier = 100;
  public inSituSampleFactor = 4;
  public inSituBeepsNumber = 10;

  public EARTH_RADIUS_KM = 6371; // km
  public SAT_SIZE = 200; // km
  public TIME_STEP = 1000.0 / 60.0; // per frame
  public OPACITY = 0.22;

  public satellites = [];
  public inSitu = [];
  
  public inSituTypes = [
    {
      id:'PF',
      name:'Profilers',
      type:'insitu',
      color:'rgba(224,80,207,0.6)'
    },
    {
      id:'SD',
      name:'Saildrones',
      type:'insitu',
      color:'rgba(80,138,224,0.6)'
    },
    {
      id:'SM',
      name:'Sea Mammals',
      type:'insitu',
      color:'rgba(99,224,80,0.6)'
    },
    {
      id:'TG',
      name:'Tide Gauge',
      type:'insitu',
      color:'rgba(255,195,0,0.75)'
    }
  ];
  public areas = [];

  public time = new Date();

  /*
   * Speed 2.0 => 30 seconds per orbit (at 60 fps)
   * So speed 60.0 => 1 second per orbit
   * Earth real speed is 86400 seconds per orbit
   * So earth real speed is (60 / 86400) * TIME_STEP multiplier
   */
  public AUTO_ROTATE_SPEED = (60.0 / 86400.0) * this.timeMultiplier;

  public satSpeed = this.TIME_STEP;

  public world;

  // This is to cancel requestAnimationFrame on updatePOV
  private requestId;

  constructor() { }

  ngOnInit() {

    this.world = Globe();

    var el = document.getElementById('globe');

    if (el) {

      this.world(el)
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png');
        //.backgroundImageUrl('assets/img/ocean.png');
      
      // Rotate globe
      this.world.controls().autoRotate = !this.frozen;
      this.world.controls().autoRotateSpeed = this.AUTO_ROTATE_SPEED;

      setTimeout(() => this.world.pointOfView({ altitude: 3.5 }));

      this.fetchSatellites();
      this.fetchInSitu();
      this.fetchInfra();
      //this.fetchAreas();

    }

  }

  /**
   * Select an object on the globe
   * 
   * @param object obj
   */
  public select(obj) {
    if (this.selected && this.selected.name === obj.name) {
      this.unselect();
    }
    else {
      cancelAnimationFrame(this.requestId);
      this.updatePOV(this, obj);
      this.selected = obj;
    }
  }

  /**
   * Unselect an object on the globe (i.e. satellite, inSitu or infra)
   */
  public unselect() {
    this.selected = null;
    cancelAnimationFrame(this.requestId);
  }

  /**
   * Show/hide layer satellites
   */
  public showHideSatellites() {
    if (this.satellites.length === 0) {
      this.fetchSatellites();
    }
    else {
      this.unselect();
      this.world.objectsData([]);
      this.satellites = [];
    }

  }

  /**
   * Show/hide layer inSitu
   */
  public showHideInSitu() {
    if (this.inSitu.length === 0) {
      this.fetchInSitu();
    }
    else {
      this.unselect();
      this.world.pointsData([]);
      this.inSitu = [];
    }
  }

  /**
   * Freeze the time i.e. stop satellite / Earth animation
   */
  public freeze() {

    this.frozen = !this.frozen;

    if (this.frozen) {
      this.world.controls().autoRotate = false;
      this.satSpeed = 0;
      if (this.requestId) {
        cancelAnimationFrame(this.requestId);
      }
    }
    else {
      this.world.controls().autoRotate = true;
      this.satSpeed = this.TIME_STEP;
    }

  }

  /**
   * Update the globe's point of view relative to the object
   * 
   * @param self this
   * @param obj Object to fly by
   */
  private updatePOV(self, obj) {
    if (obj && obj.lat && obj.lng) {
      self.world.pointOfView({ lat: obj.lat, lng: obj.lng });
    }

    // Only satellite is a moving object
    if (obj.type === 'sat') {
      self.requestId = requestAnimationFrame(function () {
        self.updatePOV(self, obj)
      });
    }
    
  }

  /**
   * Fetch areas
   */
  private fetchAreas() {

    var self = this;

    var urls = [
      'assets/data/areas/mediterranean.json'
    ];

    var arr;

    Promise.all(
      urls.map(url =>
        fetch(url)
          .then(e => e.json())
      )
    ).then(data => {
      self.areas = data;
      self.world
        .polygonsData(self.areas)
        .polygonGeoJsonGeometry(d => d.geometry)
        .polygonAltitude(d => 0.001)
        .polygonCapColor(d => self.getColor(d.properties.title));

    });

  }


  /**
   * Retrieve inSitu data
   */
  private fetchInSitu() {

    var self = this;

    var urls = [];
    for (var i = 0, ii = self.inSituTypes.length; i < ii; i++) {
      urls.push('assets/data/insitu/insitu_' + self.inSituTypes[i].id.toLowerCase() + '.json');
    };

    var arr;

    Promise.all(
      urls.map(url =>
        fetch(url)
          .then(e => e.json())
      )
    ).then(data => {
      arr = data.flat();
      self.inSitu = self.sampleArray(arr, self.inSituSampleFactor);
      self.world
        .pointsData(self.inSitu)
        .pointLat(d => {
          var lat = d.coords.lats[d.coords.posLat];
          d.coords.posLat = d.coords.posLat + 1 > d.coords.lats.length - 1 ? 0 : d.coords.posLat + 1;
          return lat;
        })
        .pointLng(d => {
          var lon = d.coords.lons[d.coords.posLon];
          d.coords.posLon = d.coords.posLon + 1 > d.coords.lons.length - 1 ? 0 : d.coords.posLon + 1;
          return lon;
        })
        .pointAltitude(0)
        .pointLabel(d => d.id)
        .pointColor(d => self.getColor(d.type))

      // Random beep on inSitu data
      self.startBeeper();

      /*setInterval(() => {
        self.world.pointsData(self.inSitu);
      }, 1000);*/

    });

  }

  /**
   * Retrieve infra data
   */
  private fetchInfra() {

    var self = this;

    const dataCenterParse = ([id, name, city, country, type, lat, lng]) => ({ id, name, city, country, type, lat, lng });

    fetch('assets/data/data_centers.txt')
      .then(
        r => r.text()
      )
      .then(
        rawData => {
          var dataCenters = d3.csvParseRows(rawData, dataCenterParse);
          var routes = self.getInfraPaths(dataCenters);
          self.world
            .labelsData(dataCenters)
            .labelLat(d => d.lat)
            .labelLng(d => d.lng)
            .labelText(d => d.id)
            .labelSize(d => 0.2)
            .labelDotRadius(d => 0.3)
            .labelColor(d => self.getColor(d.type))
            .labelResolution(2)
            .onLabelClick(function (obj) {
              self.selected = obj;
            })

            .arcsData(routes)
            .arcLabel(d => `${d.src.id} &#8594; ${d.dst.id}`)
            .arcStartLat(d => d.src.lat)
            .arcStartLng(d => d.src.lng)
            .arcEndLat(d => d.dst.lat)
            .arcEndLng(d => d.dst.lng)
            .arcDashLength(0.25)
            .arcDashGap(0.2)
            .arcDashInitialGap(() => Math.random())
            .arcDashAnimateTime(4000)
            .arcColor(d => [`rgba(0,255,0,0.6)`, `rgba(255,255,0,0.6)`])
            //.arcColor(d => 'rgb(0,255,0)')
            .arcsTransitionDuration(0)
        }
      );


  }

  /**
   * Retrieve satellites data
   */
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
        self.selected = obj;
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
            .filter(d => {
              return d.startsWith('#') ? null : d;
            })
            .map(tle => tle.split('\n'));
          self.satellites = tleData.map(
            ([name, ...tle]) => {
              let cleanName = name.trim().replace(/^0 /, '')
              return {
                //@ts-ignore
                satrec: satellite.twoline2satrec(...tle),
                name: cleanName,
                type: 'sat',
                lat: 0,
                lng: 0,
                alt: 0,
                properties: self.getSatelliteProperties(cleanName)
              }
            }
          )
            // exclude those that can't be propagated
            .filter(d => !!satellite.propagate(d.satrec, new Date()).position)
            .slice(0, 2000);

          (function frameTicker() {
            requestAnimationFrame(frameTicker);

            self.time = new Date(+self.time + (self.satSpeed * self.timeMultiplier));
            timeLogger.innerText = self.time.toUTCString();

            // Update satellite positions
            const gmst = satellite.gstime(self.time);
            self.satellites.forEach(d => {
              const eci = satellite.propagate(d.satrec, self.time);
              if (typeof eci.position !== 'boolean' && eci.position) {
                const gdPos = satellite.eciToGeodetic(eci.position, gmst);
                d.lat = gdPos.latitude * 180 / Math.PI;
                d.lng = gdPos.longitude * 180 / Math.PI;
                d.alt = gdPos.height / self.EARTH_RADIUS_KM;

              }
            });

            self.world.objectsData(self.satellites);

          })();

        }
      );
  }

  /**
   * Return display from various object type
   * 
   * @param type Object type
   * @returns 
   */
  private getColor(type) {

    switch (type) {

      // Sea Mammal
      case 'SM':
        return 'rgba(99,224,80,0.6)';

      // Saildrone
      case 'SD':
        return 'rgba(80,138,224,0.6)';

      // Tide gauge
      case 'TG':
        return 'rgba(255,195,0,0.75)';

      // Profilers
      case 'PF':
        return 'rgba(224,80,207,0.6)';

      case 'HPC':
        return 'rgba(255,255,0,0.75)';

      case 'PRODUCER':
        return 'rgba(175,225,175,0.75)';

      case 'EDITO':
        return 'rgba(15,122,175,0.75)';

      case 'Mediterranean sea':
        return 'rgba(255,255,0,0.2)';

      default:
        return 'rgba(255,255,255,0.75)';
    }

  }

  /**
   * Generate dummy inSitu activity
   */
  private startBeeper() {

    var self = this;

    if (this.inSitu && this.inSitu.length > 0) {

      setInterval(() => {
        var item, beeps = [];
        for (var i = self.inSituBeepsNumber; i--;) {
          item = self.inSitu[Math.floor(Math.random() * self.inSitu.length)];
          beeps.push({
            lat: item.coords.lats[0],
            lng: item.coords.lons[0],
            color: self.getColor(item.type),
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

  /**
   * Compute network paths from data centers
   * 
   * @param centers Array of data centers
   */
  private getInfraPaths(centers) {
    var edito = centers[0];
    var routes = [];
    for (var i = 1, ii = centers.length; i < ii; i++) {
      if (centers[i].type === 'HPC') {
        for (var j = 3; j--;) {
          routes.push({
            type: 'HPC',
            src: edito,
            dst: centers[i]
          });
        }

      }
      else if (centers[i].type === 'PRODUCER') {
        for (var j = 3; j--;) {
          routes.push({
            type: 'PRODUCER',
            src: centers[i],
            dst: edito
          });
        }
      }
    }
    return routes;
  }

  private getSatelliteProperties(name) {

    switch (name) {

      case 'Sentinel-1A':
      case 'Sentinel-1B':
        return {
          infoUrl: 'https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-1',
          color: '#0074D9'
        };

      case 'Sentinel-2A':
      case 'Sentinel-2B':
        return {
          infoUrl: 'https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-2',
          color: '#2ECC40'
        };

      case 'Sentinel-3A':
      case 'Sentinel-3B':
        return {
          infoUrl: 'https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-3',
          color: '#FFDC00'
        };

      case 'Sentinel-6MF':
        return {
          infoUrl: 'https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-6',
          color: '#FF851B'
        };

      case 'Suomi-NPP':
        return {
          infoUrl: 'https://en.wikipedia.org/wiki/Suomi_NPP',
          color: '#AAAAAA'
        };

      case 'METOP-B':
      case 'METOP-C':
        return {
          infoUrl: 'https://en.wikipedia.org/wiki/MetOp',
          color: '#AAAAAA'
        };

      default:
        return {
          infoUrl: 'https://en.wikipedia.org/wiki/' + name,
          color: '#AAAAAA'
        };
    }

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
        // Set pos to -1
        arr[i].coords.posLon = 0;
        arr[i].coords.posLat = 0;
        samples.push(arr[i]);
      }
    }
    return samples;
  }

}