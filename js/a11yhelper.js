class A11yHelper {

  static putA11yToMap(map) {
    let hasDisabledZoomBtn = false;

    map.on('layeradd', event => {
      let elements = document.getElementsByClassName('leaflet-marker-pane');

      for (let element of elements) {
        for (let img of element.children) {

          if (img.localName === 'img' && !img.hasAttribute('aria-hidden')) {
            img.setAttribute('aria-hidden', "true");
            img.setAttribute('tabIndex', "-1");
          }
        }
      }

      if (!hasDisabledZoomBtn) {
        for (let element of document.getElementsByClassName('leaflet-control-zoom')) {
          for (let zoomBtn of element.children) {
            if (zoomBtn.localName === 'a' && !zoomBtn.hasAttribute('aria-hidden')) {
              zoomBtn.setAttribute('aria-hidden', "true");
              zoomBtn.setAttribute('tabIndex', "-1");
            }
          }
        }
      }
    })

    let elements = document.getElementsByClassName('leaflet-control-attribution');

    for (let element of elements) {

      for (let ahref of element.children) {
        if (ahref.localName === 'a' && !ahref.hasAttribute('aria-hidden')) {
          ahref.setAttribute('aria-hidden', "true");
          ahref.setAttribute('tabIndex', "-1");
        }
      }
    }

    const mapContainer = document.getElementById('map')
    mapContainer.setAttribute('aria-hidden', "true")
    mapContainer.setAttribute('tabIndex', '-1');
  }
}