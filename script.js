/////////// Initialization Params ////////////

mapboxgl.accessToken = "pk.eyJ1IjoiY2FybGVkZ2UiLCJhIjoiY2tsd2kxa245MmlwazJ1bHdhendncGYzNSJ9.ejONKNoTMvl1kNIdS9SRyQ"

// Determine which years appear on the timeline
const years = [
  1715,
  1721,
  1747,
  1765,
  1767,
  1768,
  1770,
  1771,
  1773,
  1775,
  1777,
  1783,
  1785,
  1791,
  1798,
  1804,
  1805,
  1806,
  1816,
  1817,
  1819,
  1835
]

// The title of the application
appTitle = "Atlas of Cherokee Land Loss 1715–1835"

// Determine the start and end of the timeline
const timelineStart = 1712
const timelineEnd = 1838

// Set colors for confidence levels
const colors = {"low": "#FE7656", "moderate": "#FE7656", "high": "#FE7656", "cession": "#FE7656"}

let hoveredFeatureId = null
let selectedFeatureId = null    
let hoveredOnPoint = false
  
// Adjust the display of the map for mobile
let mapPaddingTop
let mapPaddingBottom
let pointOffset
const mediaQuery = window.matchMedia('(max-width: 600px)')
mediaQuery.addListener(handleViewportChange)
handleViewportChange(mediaQuery)

main()

async function main() {
  
  const data = {}
  data.cededAreas = await loadData('https://raw.githubusercontent.com/friendlyswiss/cherokee-land-cessions/main/geojson-source/cherokee-cessions/ceded-areas.geojson')
  data.boundaryLines = await loadData('https://raw.githubusercontent.com/friendlyswiss/cherokee-land-cessions/main/geojson-source/cherokee-cessions/boundary-lines.geojson')
  data.boundaryPoints = await loadData('https://raw.githubusercontent.com/friendlyswiss/cherokee-land-cessions/main/geojson-source/cherokee-cessions/boundary-points.geojson')
  data.contextPoints = await loadData('https://raw.githubusercontent.com/friendlyswiss/cherokee-land-cessions/main/geojson-source/cherokee-cessions/context-points.geojson')
  data.bibliography = await loadData('https://raw.githubusercontent.com/friendlyswiss/cherokee-land-cessions/main/geojson-source/cherokee-cessions/bibliography.json')
  initialize(data)
}

async function loadData(url) {
  return fetch(url).then(response => response.json())
}

function initialize(data) {
  
  const initial = {}
  const sources = getSources()
  setInitialStateFromURL()

  const mapParams = {
    container: "map",
    style: "mapbox://styles/carledge/ckubd70l70lvl17oi7ujpbdzd",
    bounds: initial.bounds,
    fitBoundsOptions: {padding: {top: mapPaddingTop, bottom: mapPaddingBottom, left: 20, right: 20}},
    maxBounds: [[-115, 2],[-53, 63]],
    dragRotate: false,
    touchZoomRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    logoPosition: 'bottom-right',
    attributionControl: false,
    renderWorldCopies: false
  }
  if (initial.scope == "point") {
    mapParams.center = initial.center
    mapParams.zoom = 13
    mapParams.offset = [0, pointOffset]
  }
  
  // Create basemap
  let map = new mapboxgl.Map(mapParams)
  map.touchZoomRotate.enable()
  map.touchZoomRotate.disableRotation()
  if (initial.scope == "point") { map.easeTo({center: initial.center, duration: 1, offset: [0, pointOffset]}) }
  
  // Render GeoJSON data
  map.on("load", function () {
    
    ///////////////////////// Add Symbol Images ///////////////////////////
    
    map.loadImage('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Airplane_silhouette.svg/200px-Airplane_silhouette.svg.png', function(error, image) {
      if (error) throw error;
      map.addImage('airplane', image, {sdf: true})
    })
      
    ///////////////////////// Add Map Sources ///////////////////////////
      
    map.addSource("ceded-areas", {
      type: "geojson",
      data: data.cededAreas,
      generateId: true
    });
    
    map.addSource("boundary-lines", {
      type: "geojson",
      data: data.boundaryLines,
    });
    
    map.addSource("boundary-points", {
      type: "geojson",
      data: data.boundaryPoints,
    });
    
    map.addSource("context-points", {
      type: "geojson",
      data: data.contextPoints,
      generateId: true
    });

    ///////////////////////// Add Map Layers ///////////////////////////
    
    map.addLayer({
      id: "ceded-areas",
      type: "fill",
      source: "ceded-areas",
      paint: {
        'fill-color': [
          'case',
          ['all', ['==', ['get', "startYear"], initial.year], ['!=', ['get', "startYear"], years[0]], ['==', ['get', "newOrExisting"], "new"]],
          colors.cession,
          '#000000'
        ],
        'fill-opacity': 0.5
      },
      filter: ['all', ['>=', initial.year, ['get', 'startYear']], ['>', ['get', 'endYear'], initial.year]]
    })

    map.addLayer({
      id: "boundary-lines",
      type: "line",
      source: "boundary-lines",
      layout: {
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        'line-opacity': 0.01,
        'line-width': 10
      },
      filter: ["==", initial.year, ['get', "year"]]
    });
    
    map.addLayer({
      id: "boundary-lines-highlight",
      type: "line",
      source: "boundary-lines",
      layout: {
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        "line-color": '#ffffff',
        "line-width": [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          9,
          ['boolean', ['feature-state', 'selected'], false],
          7,
          0
        ]
      },
      filter: ["==", initial.year, ['get', "year"]]
    });

    map.addLayer({
      id: "boundary-lines-fill",
      type: "line",
      source: "boundary-lines",
      layout: {
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        "line-color": [
          'match',
          ["get", "confidence"],
          "Low",
          colors.low,
          "Moderate",
          colors.moderate,
          "High",
          colors.high,
          '#000000'
        ],
        'line-width': 3
      },
      filter: ["all", ["==", initial.year, ['get', "year"]], ["any", ["!=", ["get", "surveyed"], "No"], ["!=", ["get", "natural"], "No"]]]
    });

    map.addLayer({
      id: "boundary-lines-dashed",
      type: "line",
      source: "boundary-lines",
      layout: {
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        "line-color": [
          'match',
          ["get", "confidence"],
          "Low",
          colors.low,
          "Moderate",
          colors.moderate,
          "High",
          colors.high,
          '#000000'
        ],
        "line-dasharray": ["literal", [2,2]],
        'line-width': 3
      },
      filter: ["all", ["==", initial.year, ['get', "year"]], ["==", ["get", "surveyed"], "No"], ["==", ["get", "natural"], "No"]]
    });
    
    map.addLayer({
      id: "boundary-points",
      type: "circle",
      source: "boundary-points",
      paint: {
        "circle-opacity": 0.01,
        'circle-radius': 8.5,
      },
      filter: ["==", initial.year, ['get', "year"]]
    });
    
    map.addLayer({
      id: "boundary-points-highlight",
      type: "circle",
      source: "boundary-points",
      paint: {
        "circle-color": '#ffffff',
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          8,
          ['boolean', ['feature-state', 'selected'], false],
          7,
          0
        ],
      },
      filter: ["==", initial.year, ['get', "year"]]
    });
    
    map.addLayer({
      id: "boundary-points-fill",
      type: "circle",
      source: "boundary-points",
      paint: {
        "circle-color": [
          'match',
          ["get", "confidence"],
          "Low",
          colors.cession,
          "Moderate",
          '#ffff00',
          "High",
          '#00ff00',
          '#333333'
        ],
        'circle-radius': 4,
        'circle-stroke-color': '#000000',
        'circle-stroke-width': 1
      },
      filter: ["==", initial.year, ['get', "year"]]
    });
    
    map.addLayer({
      id: "context-points",
      type: "circle",
      source: "context-points",
      paint: {
        "circle-opacity": 0.01,
        'circle-radius': 8.5,
      },
      filter: ['all', ['>=', initial.year, ['get', 'startYear']], ['>', ['get', 'endYear'], initial.year]]
    })
    
    map.addLayer({
      id: "context-points-symbol",
      type: "symbol",
      source: "context-points",
      layout: {
        "icon-image": 'campsite-11',
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0,
          ['boolean', ['feature-state', 'selected'], false],
          0,
          1
        ]
      },
      filter: ['all', ['>=', initial.year, ['get', 'startYear']], ['>', ['get', 'endYear'], initial.year]]
    })
    
    map.addLayer({
      id: "context-points-highlight",
      type: "symbol",
      source: "context-points",
      layout: {
        "icon-image": 'campsite-15',
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          1,
          ['boolean', ['feature-state', 'selected'], false],
          1,
          0
        ]
      },
      filter: ['all', ['>=', initial.year, ['get', 'startYear']], ['>', ['get', 'endYear'], initial.year]]
    })

    if (initial.scope == "line") {
      map.setFeatureState(
        { source: 'boundary-lines', sourceLayerId: 'boundary-lines-highlight', id: selectedFeatureId },
        { selected: true }
      )
    }
    else if (initial.scope == "point") {
      map.setFeatureState(
        { source: 'boundary-points', sourceLayerId: 'boundary-points-highlight', id: selectedFeatureId },
        { selected: true }
      )
    }

  })
  
    ///////////////////////// App States ////////////////////////

  function setInitialStateFromURL() { // Read the initial state from the URL
    
    // Get pathname from target URL
    let path = window.location.pathname    
    // Remove starting "/"
    path = path.substring(1)
    // Remove ending "/" if it exists
    if (path.charAt(path.length - 1) == "/") {
      path = path.substring(0, path.length - 1);
    }
    
    // If no URL string exists, default to first year
    if (path === "") {
      initial.scope = "year"
      initial.year = years[0]
      initial.bounds = getYearBounds(initial.year)
      showYearContent()
      initTimeline()
    }

    // Otherwise, process the URL string
    else {
      // Break pathname into parts
      let pathArray = path.split("/")
      
      // Process URLs with one level
      if (pathArray.length === 1) {
        if (matchesYear(pathArray[0])) {
          initial.scope = "year"
          initial.year = parseInt(pathArray[0])
          initial.bounds = getYearBounds(initial.year)
          setYearTags()
          showYearContent()
          initTimeline()
        }
        else {
          // Send to 404 page
          console.log("404 – First part of path does not match a year")
          window.location.href = '/not-found'
        }
      }

      // Process URLs with two levels
      else if (pathArray.length === 2) {
        if (matchesCession(pathArray[1]) && matchesYear(pathArray[0])) {
          initial.cession = data.cededAreas.features.find(x => x.properties.slug === pathArray[1])
          initial.year = initial.cession.properties.startYear
          if (initial.year === parseInt(pathArray[0])) {
            initial.scope = "cession"
            initial.bounds = getCessionBounds(initial.cession)
            setCessionTags()
            showCessionContent()
            initTimeline()
          }
          else {
            // Send to 404 page
            console.log("404 – Year and cession do not match")
          }
        } 
        else { 
          // Send to 404 page
          console.log("404 – First part of path is not a year or second part of path does not match a cession")
        }
      }

      // Process URLs with three levels
      else if (pathArray.length === 3) {
        if (matchesLine(pathArray[2])) {
          initial.scope = "line"
          initial.feature = data.boundaryLines.features.find(x => x.properties.slug === pathArray[2])
          initial.bounds = getLineStringBounds(initial.feature)
        }
        else if (matchesPoint(pathArray[2])) {
          initial.scope = "point"
          initial.feature = data.boundaryPoints.features.find(x => x.properties.slug === pathArray[2])
          initial.bounds = null
          initial.center = initial.feature.geometry.coordinates
        }
        else { 
            // Send to 404 page
            console.log("404 – Third part of path does not match a line or point feature")
        }
        if (matchesCession(pathArray[1]) && matchesYear(pathArray[0])) {
          
          initial.cession = data.cededAreas.features.find(x => x.properties.slug === pathArray[1])
          initial.year = initial.cession.properties.startYear
          if (initial.feature.properties.cession === initial.cession.properties.name && initial.year === parseInt(pathArray[0])) {
            selectedFeatureId = initial.feature.id
            setFeatureTags()
            showFeatureContent(initial.feature)
            initTimeline()
          }
          else {
            // Send to 404 page
            console.log("404 – Feature and cession do not match or cession and year do not match")
          }
        }
        else {
          // Send to 404 page
          console.log("404 – First part of path is not a year or second part of path does not match a cession")
        }
      }
      else if (pathArray.length > 3) {
        // Send to 404 page
        console.log("404 – Paths longer than four parts do not exist")
      }
    }

    function matchesYear(slug) {
      if (/^[0-9]{4}$/.test(slug) && years.includes(parseInt(slug))) {
        return true
      }
      else {
        return false
      }
    }
    
    function matchesCession(slug) {
      const cessionSlugs = []
      for (cession of data.cededAreas.features) {
        cessionSlugs.push(cession.properties.slug)
      }
      if (cessionSlugs.includes(slug)) {
        return true
      }
      else {
        return false
      }
    }
    
    function matchesLine(slug) {
      const lineSlugs = []
      for (line of data.boundaryLines.features) {
        lineSlugs.push(line.properties.slug)
      }
      if (lineSlugs.includes(slug)) {
        return true
      }
      else {
        return false
      }
    }
    
    function matchesPoint(slug) {
      const pointSlugs = []
      for (point of data.boundaryPoints.features) {
        pointSlugs.push(point.properties.slug)
      }
      if (pointSlugs.includes(slug)) {
        return true
      }
      else {
        return false
      }
    }
  }

  function setActiveYear(year, preventPushState) {

    if (preventPushState !== true) {
      window.history.pushState(
        {
          "scope": "year",
          "feature": null,
          "cession": null,
          "year": year
        },
        parseInt(year),
        "/" + year
      )
    }
    setYearTags()
    updateTimeline()
    showYearContent()
    fitMapTo(year)
    filterMapByActiveYear()
    removeSelectionHighlight()
  }
  
  function setActiveCession(cession, preventPushState) {
    
    if (preventPushState !== true) { 
      window.history.pushState(
        {
          "scope": "cession",
          "feature": null,
          "cession": cession.properties.slug,
          "year": cession.properties.startYear
        },
        cession.properties.name,
        "/" + cession.properties.startYear + "/" + cession.properties.slug
      )
    }
    setCessionTags()
    updateTimeline()
    showCessionContent()
    fitMapTo(cession)
    filterMapByActiveYear()
    removeSelectionHighlight()   
  }
  
  function setActiveFeature(feature, preventPushState) {
    
    //If feature is selected from map, use the matching GeoJSON feature instead
    if (feature._vectorTileFeature) {
      feature = getGeojsonMatchOf(feature)
    }

    if (preventPushState !== true) {
      window.history.pushState(
        {
          "scope": "feature", 
          "feature": feature.properties.slug,
          "cession": parentCessionOf(feature).properties.slug, //Referencing the parent cession because feature.properties.cession is a proper name and not a slug
          "year": feature.properties.year
        },
        feature.properties.name,
        "/" + feature.properties.year + "/" + parentCessionOf(feature).properties.slug + "/" + feature.properties.slug
      )
    }
    setFeatureTags()
    updateTimeline()
    showFeatureContent()
    fitMapTo(feature)
    filterMapByActiveYear()
    addSelectionHighlightTo(activeFeature())
  }

  function activeYear() {
    let year
    if (history.state !== null) {
      year = history.state.year
    }
    else {
      year = initial.year
    }
    return year
  }

  function prevYear() {
    let year
    if (activeYear() == years[0]) {
      year = null
    }
    else {
      year = years[years.indexOf(activeYear()) - 1]
    }
    return year
  }

  function nextYear() {
    let year
    if (activeYear() == years[years.length - 1]) {
      year = null
    }
    else {
      year = years[years.indexOf(activeYear()) + 1]
    }
    return year
  }

  function activeCession() {
    let cession
    if (history.state !== null) {
      cession = data.cededAreas.features.find(x => x.properties.slug === history.state.cession)
    }
    else {
      cession = initial.cession
    }
    return cession
  }

  function activeFeature() {
    let feature
    if (history.state !== null) {
      feature = data.boundaryLines.features.find(x => x.properties.slug === history.state.feature)
      if (feature == null) {
        feature = data.boundaryPoints.features.find(x => x.properties.slug === history.state.feature)
      }
    }
    else {
      feature = initial.feature
    }
    return feature
  }
  
  function setYearTags() {
    document.title = activeYear() + " | " + appTitle
    let description = ""
    document.querySelector('meta[name="description"]').setAttribute("content", description)
  }

  function setCessionTags() {
    document.title = activeCession().properties.name + " | " + appTitle
    let description = ""
    document.querySelector('meta[name="description"]').setAttribute("content", description)
  }

  function setFeatureTags() {
    document.title = activeFeature().properties.name + " | " + appTitle
    let description = ""
    document.querySelector('meta[name="description"]').setAttribute("content", description)
  }
  
  function getSources() {
    let sources = []
    for (const source of data.bibliography.sources) { 
      sources.push(source.slug) 
    }
    return sources
  }
  
  ///////////////////// Timeline ///////////////////////

  function updateTimeline() {
    setArrowStates()
    updateFilling()
    setActiveTimelinePoint()
    setOlderEvents()
    scrollTimeline()

    function setArrowStates() {
      // Set inactive class on previous/next navigation if first or last year
      // Set href values for previous/next navigation

      let prevA = document.getElementById('prev-timeline')
      let nextA = document.getElementById('next-timeline')

      if (activeYear() == years[0]) {
        prevA.classList.add('inactive')
        nextA.classList.remove('inactive')
        prevA.removeAttribute('href')
        nextA.href = years[1]
      } 
      else if (activeYear() == years[years.length - 1]) {
        prevA.classList.remove('inactive')
        nextA.classList.add('inactive')
        nextA.removeAttribute('href')
        prevA.href = years[years.length - 2]
      }
      else {
        prevA.classList.remove('inactive')
        nextA.classList.remove('inactive')
        prevA.href = "/" + years[years.indexOf(activeYear()) - 1]
        nextA.href = "/" + years[years.indexOf(activeYear()) + 1]
      }
    }

    function updateFilling() {
      //change .filling-line length according to the selected event
      let filling = document.getElementById("filling-line")
      let yearLi = document.querySelectorAll("#events li._" + activeYear())[0]
      let eventWidth = yearLi.style.left
      filling.style.setProperty("width", eventWidth)
    }

    function setActiveTimelinePoint() {
      let yearA = document.querySelectorAll('._' + activeYear())[0].firstChild
      Array.from(document.querySelectorAll('.selected')).forEach((el) => el.classList.remove('selected'));
      yearA.classList.add('selected');
    }

    function setOlderEvents() {
      let selected = document.querySelectorAll('.selected')[0].parentElement

      while (selected = selected.previousElementSibling) {
        selected.firstChild.classList.add('older-event')
      }

      selected = document.querySelectorAll('.selected')[0].parentElement
      selected.firstChild.classList.remove('older-event')

      while (selected = selected.nextElementSibling) {
        selected.firstChild.classList.remove('older-event')
      }
    }

    function scrollTimeline(direction) {
      
      let selected = document.querySelectorAll('.selected')[0]

      if (!isInViewport(selected)) {
        const style = getComputedStyle(selected.parentElement)
        let translateValue = (style.left.replace('px',''))

        if (selected.getBoundingClientRect().left < 0) {
          document.getElementById('events-wrapper').scroll({
            left: (translateValue - document.getElementById('events-wrapper').offsetWidth + 60),
            behavior: 'smooth'
          })
        }
        else {
          document.getElementById('events-wrapper').scroll({
            left: (translateValue - 60),
            behavior: 'smooth'
          })
        }
      }

      function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
          rect.top >= 40 &&
          rect.left >= 40 &&
          rect.bottom <= ((window.innerHeight || document.documentElement.clientHeight) - 40) &&
          rect.right <= ((window.innerWidth || document.documentElement.clientWidth) - 40)
        );
      }
    }
  }

  function initTimeline() {

    addTimelineEvents()
    updateTimeline()

    // Set default horizontal scroll so that the initial year is near the left side of the screen
    let initialSelection = document.querySelectorAll("#events li._" + activeYear())[0]
    let translateValue = (getComputedStyle(initialSelection).left.replace('px',''))
    document.getElementById('events-wrapper').scroll(translateValue - 60, 0)
    
    // The timeline has been initialized - show it
    document.getElementById('timeline').classList.add('loaded')

    // Detect click on the previous arrow
    document.getElementById('prev-timeline').addEventListener('click', function (e) {
      e.preventDefault()
      if (prevYear()) {
        setActiveYear(prevYear())
      }
    })

    // Detect click on the next arrow
    document.getElementById('next-timeline').addEventListener('click', function (e) {
      e.preventDefault()
      if (nextYear()) {
        setActiveYear(nextYear())
      }
    })

    // Detect click on a single event
    document.getElementById("events-wrapper").addEventListener('click', function (e) {
      if (e.target !== null) {
        if (e.target.tagName.toLowerCase() === 'a') {
          e.preventDefault();
          setActiveYear(parseInt(e.target.textContent))
        }
      }
    })

    function addTimelineEvents() {
    
    // Create an event for every item in the years array and place it on the timeline
    
    let eventList = document.querySelectorAll('#events ol')[0]
    for (const year of years) { 
      let event = document.createElement('li')
      const yearsFromStart = year - timelineStart
      event.style.left = yearsFromStart / (timelineEnd - timelineStart) * 100 + '%'
      event.classList.add("_" + year)
      let button = document.createElement('a')
      button.textContent = year
      button.href = "/" + year
      event.appendChild(button)
      eventList.appendChild(event)
    }
    
    // Add decade labels to the timeline
    
    let firstYears = 0
    while ((timelineStart + firstYears) % 10 !== 0) {
      firstYears++
    }
    let decades = document.getElementById('decades');
    let left = 0
    for (i = timelineStart; i <= timelineEnd; i++) {
      if (i % 10 === 0) {
        let decade = document.createElement('li');
        decade.classList.add(i);
        decade.textContent = i;
        decade.style.left = (firstYears + left) / (timelineEnd - timelineStart) * 100 + '%'
        decades.appendChild(decade);
        left = left + 10
      }
    }
    }
  }
  
  /////////////////////// Getters //////////////////////////
  
  function cessionsOf(year) {
    //Generates an ordered array of new (not modified) cessions that start in a given year
    const cessions = data.cededAreas.features.filter(cession => 
      cession.properties.startYear == year &&
      cession.properties.newOrExisting == "new"
    )
    cessions.sort((a, b) => (a.properties.order > b.properties.order) ? 1 : -1)   
    return cessions
  }
  
  function featuresOf(cession) {
    //Build a list of features for this year and cession and order them
    const lines = data.boundaryLines.features.filter(line =>
      line.properties.year == cession.properties.startYear &&
      line.properties.cession == cession.properties.name
    )
    const points = data.boundaryPoints.features.filter(point =>
      point.properties.year == cession.properties.startYear &&
      point.properties.cession == cession.properties.name
    )
    const features = lines.concat(points)
    features.sort((a, b) => (a.properties.order > b.properties.order) ? 1 : -1)
    return features
  }

  function parentCessionOf(feature) {
    //Generates an array of (though there should only be one)
    const parentCessions = data.cededAreas.features.filter(cession =>
      cession.properties.newOrExisting == "new" &&
      cession.properties.startYear == feature.properties.year &&
      cession.properties.name == feature.properties.cession
    )
    return parentCessions[0]
  }
  
  function getGeojsonMatchOf(feature) {
    //If feature is selected from the map (as a vector tile), find the matching geojson data instead
    if (feature.geometry.type == "LineString") {
      const matchingFeatures = data.boundaryLines.features.filter(match =>
        match.properties.cession == feature.properties.cession &&
        match.properties.order == feature.properties.order
      )
      return matchingFeatures[0]
    } else if  (feature.geometry.type == "Point") {
      const matchingFeatures = data.boundaryPoints.features.filter(match =>
        match.properties.cession == feature.properties.cession &&
        match.properties.order == feature.properties.order
      )
      return matchingFeatures[0]
    }
  }

  function featureURL(feature) {
    return "/" + feature.properties.year + "/" + parentCessionOf(feature).properties.slug + "/" + feature.properties.slug
  }
  

  ///////////////////////// Sidebar Content ////////////////////////
  
  function showYearContent() {  
    clearSidebarContent()

    let sidebarContent = document.querySelector('#sidebar-content')
    
    ///////// Breadcrumb //////////
    
    sidebarContent.appendChild(breadcrumbs(activeYear()))

    ///////// Cessions //////////
    
    let cessions = cessionsOf(activeYear())
    for (let i = 0; i < cessions.length; i++) {
      const cession = cessions[i]
      
      //////// Cession Details ////////
      
      let cessionDetails = document.createElement('div')
      cessionDetails.classList.add('cession-details')
      
      /////// Horizontal Rule //////

      // if (i !== 0) {
      //   let hr = document.createElement('hr')
      //   cessionDetails.appendChild(hr)
      // }

      ////// Cession Header //////

      let cessionHeader = document.createElement('header')

      //// Cession Name ////

      let cessionName = document.createElement('h3')
      cessionName.classList.add('cession-name')
      cessionName.id = cession.properties.slug
      cessionName.textContent = cession.properties.name
      cessionHeader.appendChild(cessionName)      

      //// Cession Zoom ////

      let cessionZoom = document.createElement('button')
      cessionZoom.classList.add('cession-zoom', 'fit-to')
      cessionZoom.title = "Zoom to Area"
      cessionZoom.addEventListener('click', function () {
        fitMapTo(cession) 
      })
      cessionHeader.appendChild(cessionZoom)

      cessionDetails.appendChild(cessionHeader)

      ////// Cession Metadata //////

      let container = document.createElement('div')
      container.classList.add("metadata-container")
      
      const metadata = [
        ["agreementDate", "Date of Agreement"],
        ["counterparty", "Counterparty"],
        ["agreementSite","Site of Agreement"]
      ]
      
      for (const item of metadata) {
        if (cession.properties[item[0]]) {
          container.appendChild(metadataItem(cession, item[0], item[1]))
        }
      }
      
      cessionDetails.appendChild(container)

      ////// Cession Description //////

      let cessionDescription = document.createElement('div')
      cessionDescription.classList.add('cession-description')
      let descriptionHeading = document.createElement('h4')
      descriptionHeading.textContent = "Description"
      cessionDescription.appendChild(descriptionHeading)
      let descriptionText = document.createElement('p')
      descriptionText.innerHTML = cession.properties.description
      formatCitations(descriptionText)
      cessionDescription.appendChild(descriptionText)
      cessionDetails.appendChild(cessionDescription)

      ////// Cession Features //////

      const features = featuresOf(cession)
      const featureList = createListFrom(features)
      
      cessionDetails.appendChild(featureList)      
      sidebarContent.appendChild(cessionDetails);
    }

    function createListFrom(features) {
    
      ////// Feature List //////
      
      let featureList = document.createElement('div')
      featureList.classList.add('boundary-features')
      let featuresHeading = document.createElement('h4')
      featuresHeading.textContent = "Boundary Features"
      featureList.appendChild(featuresHeading)
      
      //// All Features ////
      
      for (let i = 0; i < features.length; i++) {
        let feature = features[i]
        let featureDiv = document.createElement('div')
        let featureThumbnail = document.createElement('div')
        featureThumbnail.classList.add('thumbnail')
        featureDiv.appendChild(featureThumbnail)
        
        // Feature Name //
        
        let featureName = document.createElement('a')
        featureName.classList.add('feature-name')
        featureName.href = featureURL(feature)
        featureName.textContent = i + 1 + ". " + feature.properties.name
        featureName.addEventListener('click', function (e) {
          e.preventDefault()
          setActiveFeature(feature)
        })
        featureDiv.appendChild(featureName)
        
        // Zoom Button //
        
        let zoom = document.createElement('button')
        zoom.addEventListener('click', function () {
          fitMapTo(feature)
        })
        
        //// Point Thumbnail & Zoom Title ////
        
        if (feature.geometry.type == "Point") {          
          featureDiv.classList.add('feature', 'point')
          
          let dot = document.createElement('span')
          if (feature.properties.confidence) {
            dot.style.background = colors[feature.properties.confidence.toLowerCase()]
          }
          featureThumbnail.appendChild(dot)
          
          zoom.classList.add('point-zoom', 'fit-to')
          zoom.title = "Zoom to Point"
          featureDiv.appendChild(zoom)
        }

        //// Line Thumbnail & Zoom Title ////
        
        if (feature.geometry.type == "LineString") {          
          featureDiv.classList.add('feature', 'line')
          
          let line = document.createElement('hr')
          if (features[i].properties.confidence) {
            line.style.borderTop = "3px " + lineStyle(feature) + " " + colors[feature.properties.confidence.toLowerCase()]
          }
          featureThumbnail.appendChild(line)
          
          zoom.classList.add('line-zoom', 'fit-to')
          zoom.title = "Zoom to Line"
          featureDiv.appendChild(zoom)
        }
        
        featureList.appendChild(featureDiv)
      }
      return featureList
    }
  }
  
  function showCessionContent() {
    showYearContent()
    document.getElementById(activeCession().properties.slug).scrollIntoView(
      //{block: 'nearest'}
      //{behavior: 'smooth'}
    )
    //location.hash = "#" //reset hash to a dummy value
    //location.hash = "#" + cession.properties.slug
  }
  
  function showFeatureContent() {  
    clearSidebarContent()
    
    let feature = activeFeature()

    let sidebarWrapper = document.querySelector('#sidebar-wrapper')
    let sidebarContent = document.querySelector('#sidebar-content')
    
    ///////// Breadcrumb //////////

    sidebarContent.appendChild(breadcrumbs(feature.properties.year, feature))

    //////// Feature Details ////////
    
    let featureDetails = document.createElement('div');
    featureDetails.classList.add('feature-details');
    
    ////// Feature Header //////
    
    let featureHeader = document.createElement('header')
    
    //// Feature Name ////
    
    let featureName = document.createElement('h3')
    //featureName.classList.add('feature-name')
    featureName.textContent = feature.properties.name
    featureHeader.appendChild(featureName)
    
    //// Feature Zoom ////
    
    let zoom = document.createElement('button')
    zoom.addEventListener('click', function () {
      fitMapTo(feature)
    })
    
    if (feature.geometry.type == "LineString") {
      zoom.classList.add('line-zoom', 'fit-to')
      zoom.title = "Zoom to Line"
    }
    else if (feature.geometry.type == "Point") {
      zoom.classList.add('point-zoom', 'fit-to')
      zoom.title = "Zoom to Point"
    } 
    
    featureHeader.appendChild(zoom)
   
    featureDetails.appendChild(featureHeader)
    
    ////// Feature Metadata //////

    let container = document.createElement('div')
    container.classList.add("metadata-container")

    const metadata = [
      ["confidence", "Confidence"],
      ["natural", "Natural"],
      ["surveyed","Surveyed"]
    ]

    for (const item of metadata) {
      if (feature.properties[item[0]]) {
        container.appendChild(metadataItem(feature, item[0], item[1]))
      }
    }

    featureDetails.appendChild(container)
    
    ////// Feature Description //////
    
    let featureDescription = document.createElement('div')
    featureDescription.classList.add('feature-description')
    
    let descriptionHeading = document.createElement('h4')
    descriptionHeading.textContent = "Description"
    featureDescription.appendChild(descriptionHeading)
    
    let descriptionText = document.createElement('p')
    descriptionText.innerHTML = feature.properties.description
    formatCitations(descriptionText)
    featureDescription.appendChild(descriptionText)
    featureDetails.appendChild(featureDescription)
    
    sidebarContent.appendChild(featureDetails)
    
    //////// Previous/Next Feature Navigation ////////
    
    // Get sibling features
    const cession = parentCessionOf(feature)
    const features = featuresOf(cession)
    
    let isFirst = false
    if (feature.properties.order == 1) {isFirst = true}
    let isLast = false
    if (feature.properties.order == features.length) {isLast = true}
    
    let featureNavigation = document.createElement('nav')
    featureNavigation.id = 'feature-navigation'
    let featureNavigationUl = document.createElement('ul')
    featureNavigation.appendChild(featureNavigationUl)
    
    ////// Previous Button //////
    
    let prevLi = document.createElement('li')
    featureNavigationUl.appendChild(prevLi)
    let prev = document.createElement('a')
    prev.classList.add('prev-feature')
    if (!feature.properties.order || isFirst == true) {
      prev.classList.add('inactive')
    }
    else {
      let prevFeature = features[feature.properties.order - 2]
      prev.href = featureURL(feature)
      prev.addEventListener('click', function (e) {
        e.preventDefault()
        
        if (prevFeature) {
          setActiveFeature(prevFeature)
        }
        else { console.log("Previous feature is null") }
      })
    }
    prevLi.appendChild(prev)
    
    ////// Next Button //////
    
    let nextLi = document.createElement('li')
    featureNavigationUl.appendChild(nextLi)
    let next = document.createElement('a')
    next.classList.add('next-feature')
    if (!feature.properties.order || isLast == true) {
      next.classList.add('inactive')
    }
    else {
      let nextFeature = features[feature.properties.order] 
      next.href = featureURL(feature)
      next.addEventListener('click', function (e) {
        e.preventDefault()

        if (nextFeature) {
          setActiveFeature(nextFeature)
        }
        else { console.log("Next feature is null") }
      })
    }
    nextLi.appendChild(next)
    
    sidebarWrapper.appendChild(featureNavigation)
  }

  function clearSidebarContent() {
    let sidebarWrapper = document.getElementById("sidebar-wrapper");
    sidebarWrapper.innerHTML = '';
    let sidebarContent = document.createElement('div');
    sidebarContent.id = 'sidebar-content'
    sidebarWrapper.appendChild(sidebarContent)
  }
  
  function breadcrumbs(year, feature) {
    let breadcrumbsNav = document.createElement('nav');
    breadcrumbsNav.id = 'breadcrumbs';
    let breadcrumbList = document.createElement('ul');
    breadcrumbList.classList.add('breadcrumb-list');
    breadcrumbsNav.appendChild(breadcrumbList);

    // Add the active year to the breadcrumb
    let breadcrumbYear = document.createElement('li');
    breadcrumbYear.id = 'year';
    breadcrumbYear.textContent = year;
    breadcrumbYear.addEventListener('click', function (e) {
      setActiveYear(year)
    })
    breadcrumbList.appendChild(breadcrumbYear)

    // If there is an active feature, add the name of its cession to the breadcrumb
    if (feature) {
      let breadcrumbCession = document.createElement('li')
      breadcrumbCession.id = 'cession'
      breadcrumbCession.textContent = feature.properties.cession
      breadcrumbCession.addEventListener('click', function (e) {
        setActiveCession(parentCessionOf(feature))
      })
      breadcrumbList.appendChild(breadcrumbCession)
    }
    breadcrumbsNav.appendChild(breadcrumbList)
    return breadcrumbsNav
  }
  
  function metadataItem(feature, attribute, string) {
    let metadataDiv = document.createElement('div')
    metadataDiv.classList.add("metadata-group", attribute)

    let key = document.createElement('h4')
    key.classList.add("metadata", "key", attribute)
    key.textContent = string
    metadataDiv.appendChild(key)

    let value = document.createElement('p');
    value.classList.add("metadata", "value", attribute)
    value.textContent = feature.properties[attribute]
    metadataDiv.appendChild(value)

    return metadataDiv
  }
  
  function formatCitations(descriptionTextNode) {
    let as = descriptionTextNode.querySelectorAll('a')
    for (const a of as) {
      let href = a.getAttribute('href')
      if (!href.includes("http")) {
        let span = document.createElement('span')
        for (const slug of sources) {
          if (href == slug) {
            span.classList.add('citation')
            span.setAttribute('data-citation', slug)
            span.textContent = a.textContent
            span.addEventListener('click', function (e) {
              const item = data.bibliography.sources.filter(source =>
                source.slug == slug
              )
              showCitation(item[0])
            })
          }
        }
        a.parentNode.replaceChild(span, a)

      }
    }
    return descriptionTextNode
  }
  
  function showCitation(reference) {
    const template = document.createElement('div')
    const referenceHeading = document.createElement('h3')
    referenceHeading.textContent = "Reference"
    template.appendChild(referenceHeading)
    if (reference.citation) {
      const ref = document.createElement('p')
      ref.textContent = reference.citation
      template.appendChild(ref)
    }
    if (reference.url) {
      const linkHeading = document.createElement('h3')
      linkHeading.textContent = "Link"
      template.appendChild(linkHeading)
      const link = document.createElement('a')
      link.textContent = reference.url
      link.href = reference.url
      template.appendChild(link)
    }
    new Modal(template)
  }
  
  ///////////////////////// Map Updates ////////////////////////////
  
  function filterMapByActiveYear() {
    //Create a filter for a range of years; used for features that should accumulate over time
    let yearRangeFilter = ['all', ['>=', activeYear(), ['get', 'startYear']], ['>', ['get', 'endYear'], activeYear()]]
    map.setFilter('ceded-areas', yearRangeFilter)
    map.setFilter('context-points', yearRangeFilter)
    map.setFilter('context-points-highlight', yearRangeFilter)
    map.setFilter('context-points-symbol', yearRangeFilter)
    
    if (activeYear() !== years[0]) {
      map.setPaintProperty(
        'ceded-areas', 'fill-color', [
          'case',
          ['all', ['==', ['get', "startYear"], activeYear()], ['==', ['get', "newOrExisting"], "new"]],
          colors.cession,
          '#000000'
        ])
    };

    //Create a filter for a single year; used for features that should only appear on a specific year
    let currentYearFilter = ['==', activeYear(), ['get', 'year']]
    map.setFilter('boundary-lines', currentYearFilter)
    map.setFilter('boundary-lines-highlight', currentYearFilter)
    map.setFilter('boundary-lines-fill', ["all", currentYearFilter, ["any", ["!=", ["get", "surveyed"], "No"], ["!=", ["get", "natural"], "No"]]])
    map.setFilter('boundary-lines-dashed', ["all", currentYearFilter, ["==", ["get", "surveyed"], "No"], ["==", ["get", "natural"], "No"]])
    map.setFilter('boundary-points', currentYearFilter)
    map.setFilter('boundary-points-highlight', currentYearFilter)
    map.setFilter('boundary-points-fill', currentYearFilter)
  }
  
  function getYearBounds(year) {
    // Create a 'LngLatBounds' with both corners at the first coordinate of the first cession feature.
    const cessions = cessionsOf(year)
    let bounds = new mapboxgl.LngLatBounds(cessions[0].geometry.coordinates[0][0][0],cessions[0].geometry.coordinates[0][0][0])

    //If it's the first year on the timeline
    if (year == years[0]) {
      bounds.setSouthWest([-88.61, 33.16]).setNorthEast([-80.23, 39.24])
    }
    else {
      //If there are multiple cessions in the array
      for (let h = 0; h < cessions.length; h++) {
        // Geographic coordinates of the MultiPolygon
        const coordinates = cessions[h].geometry.coordinates;
        // Extend the 'LngLatBounds' to include every coordinate in the bounds result.
        for (let i = 0; i < coordinates.length; i++) {
          for (let j = 0; j < coordinates[i].length; j++) {
            for (let k = 0; k < coordinates[i][j].length; k++) {
              bounds.extend(coordinates[i][j][k])
            }
          }
        }
      }
    }
    return bounds
  }
  
  function getCessionBounds(cession) {
    let bounds = new mapboxgl.LngLatBounds(cession.geometry.coordinates[0][0][0],cession.geometry.coordinates[0][0][0])

    //If it's the first year on the timeline
    if (cession.properties.startYear == years[0]) {
      bounds.setSouthWest([-88.61, 33.16]).setNorthEast([-80.23, 39.24])
    }
    else {
      // Geographic coordinates of the MultiPolygon
      const coordinates = cession.geometry.coordinates;
      // Extend the 'LngLatBounds' to include every coordinate in the bounds result.
      for (let i = 0; i < coordinates.length; i++) {
        for (let j = 0; j < coordinates[i].length; j++) {
          for (let k = 0; k < coordinates[i][j].length; k++) {
            bounds.extend(coordinates[i][j][k])
          }
        }
      }
    }
    return bounds
  }
  
  function getLineStringBounds(feature) {
    // Geographic coordinates of the LineString
    const coordinates = feature.geometry.coordinates;
    // Create a 'LngLatBounds' with both corners at the first coordinate.
    const bounds = new mapboxgl.LngLatBounds(
      coordinates[0],
      coordinates[0]
    )
    // Extend the 'LngLatBounds' to include every coordinate in the bounds result.
    for (const coord of coordinates) {
      bounds.extend(coord)
    }
    return bounds
  }
  
  function fitMapTo(feature) {
    if (years.includes(feature)) { 
      map.fitBounds(getYearBounds(feature), {
        padding: {top: mapPaddingTop, bottom: mapPaddingBottom, left: 20, right: 20}
      })
    }
    else if (feature.geometry.type == "Polygon" || feature.geometry.type == "MultiPolygon") {
      map.fitBounds(getCessionBounds(feature), {
        padding: {top: mapPaddingTop, bottom: mapPaddingBottom, left: 20, right: 20}
      })
    }
    else if (feature.geometry.type == "LineString" || feature.geometry.type == "MultiLineString") {
      map.fitBounds(getLineStringBounds(feature), {
        padding: {top: mapPaddingTop, bottom: mapPaddingBottom, left: 20, right: 20}
      })
    }
    else if (feature.geometry.type == "Point") {
      map.easeTo({center: feature.geometry.coordinates, zoom: 13, duration: 2000, offset: [0, pointOffset]});
    }
  }
  
  function selectFeatureFromMap(position) {
    
    let features = map.queryRenderedFeatures(position.point, { layers: ['boundary-lines','boundary-points','context-points'] });
    if (features.length > 0) {
      
      // If a point and line overlap, the point will always be the top feature because of layer order
      let topFeature = features[0]
      
      let popupContent = document.createElement('div')
      
      if (topFeature.source == "boundary-lines" || topFeature.source == "boundary-points") {
        popupContent.classList.add('boundary-feature')
        let featureName = document.createElement('span')
        featureName.classList.add('popup-feature-name')
        featureName.textContent = topFeature.properties.name
        popupContent.appendChild(featureName)
        let infoIcon = document.createElement('a')
        infoIcon.classList.add('info-icon')
        infoIcon.href = featureURL(topFeature)
        infoIcon.addEventListener('click', function (e) {
          e.preventDefault()
          setActiveFeature(topFeature)
          collapseMap()
          const popup = document.getElementsByClassName('mapboxgl-popup');
          popup[0].remove()
        })
        popupContent.appendChild(infoIcon)
      }
      else if (topFeature.source == "context-points") {
        popupContent.classList.add('context-feature')
        let featureHeader = document.createElement('header')
        let featureName = document.createElement('span')
        featureName.classList.add('popup-feature-name')
        featureName.textContent = topFeature.properties.name
        featureHeader.appendChild(featureName)
        let closeIcon = document.createElement('button')
        closeIcon.classList.add('close-icon')
        closeIcon.addEventListener('click', function (e) {
          const popup = document.getElementsByClassName('mapboxgl-popup');
          popup[0].remove()
          map.setFeatureState(
            { source: 'context-points', sourceLayerId: 'context-points-highlight', id: selectedFeatureId },
            { selected: false }
          );
        })
        featureHeader.appendChild(closeIcon)
        popupContent.appendChild(featureHeader)
        let description = document.createElement('p')
        //description.textContent = topFeature.properties.description
        description.textContent = topFeature.properties.description
        description.classList.add('description')
        popupContent.appendChild(description)
        addSelectionHighlightTo(topFeature)
      }
      const popup = new mapboxgl.Popup({className: 'feature-popup', closeButton: false})
        .setLngLat(position.lngLat)
        .setDOMContent(popupContent)
        .addTo(map);
      // Remove selected state from context-point when closing its popup
      popup.on('close', function(e) {
        if (hoveredFeatureId == null) {
          map.setFeatureState(
            { source: 'context-points', sourceLayerId: 'context-points-highlight', id: selectedFeatureId },
            { selected: false }
          );
        }
      })
    }
  }
  
  function addSelectionHighlightTo(feature) {
    removeSelectionHighlight()
    
    selectedFeatureId = feature.id
    if (feature.geometry.type == "LineString") {
      map.setFeatureState(
        { source: 'boundary-lines', sourceLayerId: 'boundary-lines-highlight', id: selectedFeatureId },
        { selected: true }
      )
    }
    else if (feature.geometry.type == "Point") {

      if (feature.properties.cession) { //Hacky way to see if point feature is a boundary point and not a context point
        
        map.setFeatureState(
          { source: 'boundary-points', sourceLayerId: 'boundary-points-highlight', id: selectedFeatureId },
          { selected: true }
        )
      }
      else {
        map.setFeatureState(
          { source: 'context-points', sourceLayerId: 'context-points-highlight', id: selectedFeatureId },
          { selected: true }
        )
      }
    }
  }
  
  function removeSelectionHighlight() {
    //Removes selected state from boundary lines and points
    if (selectedFeatureId !== null) {
      map.setFeatureState(
        { source: 'boundary-points', sourceLayerId: 'boundary-points-highlight', id: selectedFeatureId },
        { selected: false }
      );
      map.setFeatureState(
        { source: 'boundary-lines', sourceLayerId: 'boundary-lines-highlight', id: selectedFeatureId },
        { selected: false }
      );
      map.setFeatureState(
        { source: 'context-points', sourceLayerId: 'context-points-highlight', id: selectedFeatureId },
        { selected: false }
      );
    }
  }

  function addHoverHighlights(position) {
    let features = map.queryRenderedFeatures(position.point, { layers: ['boundary-lines','boundary-points','context-points'] });
    
    if (features.length > 0) {
      map.getCanvas().style.cursor = "pointer";

      // If a feature is already selected, set its hover state to false
      // This is for when the cursor moves from one feature directly to another without leaving first
      if (hoveredFeatureId !== null) { 

        map.setFeatureState(
          { source: 'boundary-points', sourceLayerId: 'boundary-points-highlight', id: hoveredFeatureId },
          { hover: false }
        )
        map.setFeatureState(
          { source: 'boundary-lines', sourceLayerId: 'boundary-lines-highlight', id: hoveredFeatureId },
          { hover: false }
        )
        map.setFeatureState(
          { source: 'context-points', sourceLayerId: 'context-points-highlight', id: hoveredFeatureId },
          { hover: false }
        )
        map.setFeatureState(
          { source: 'context-points', sourceLayerId: 'context-points-symbol', id: hoveredFeatureId },
          { hover: false }
        )
      }

      // Save the topmost hovered feature's id to the hoveredFeatureID variable
      const topFeature = features[0]
      hoveredFeatureId = topFeature.id

      //If the topmost hovered feature is a point, set the hover state of the feature to true
      if (topFeature.geometry.type == "Point") {
        hoveredOnPoint = true
        if (topFeature.source == "boundary-points") {
          map.setFeatureState(
            { source: 'boundary-points', sourceLayerId: 'boundary-points-highlight', id: hoveredFeatureId },
            { hover: true }
          )
        } 
        else if (topFeature.source == "context-points") {
          map.setFeatureState(
            { source: 'context-points', sourceLayerId: 'context-points-symbol', id: hoveredFeatureId },
            { hover: true }
          )
        }
      }

      //If the topmost hovered feature is a line, set the hover state of the feature to true
      else if (topFeature.geometry.type == "LineString") { 
        hoveredOnPoint = false
        map.setFeatureState(
          { source: 'boundary-lines', sourceLayerId: 'boundary-lines-highlight', id: hoveredFeatureId },
          { hover: true }
        );
      }
    }
  }

  function removePointHoverHighlight() {
    map.getCanvas().style.cursor = "";
    map.setFeatureState(
      { source: 'boundary-points', sourceLayerId: 'boundary-points-highlight', id: hoveredFeatureId },
      { hover: false }
    )
    map.setFeatureState(
      { source: 'context-points', sourceLayerId: 'context-points-highlight', id: hoveredFeatureId },
      { hover: false }
    )
    map.setFeatureState(
      { source: 'context-points', sourceLayerId: 'context-points-highlight', id: hoveredFeatureId },
      { hover: false }
    )
    hoveredOnPoint = false
    hoveredFeatureId = null;
  }

  function removeLineHoverHighlight() {
    if (hoveredOnPoint == false) {
      map.getCanvas().style.cursor = "";
      map.setFeatureState(
        { source: 'boundary-lines', sourceLayerId: 'boundary-lines-highlight', id: hoveredFeatureId },
        { hover: false }
      );
      hoveredFeatureId = null;
    }
  }
  
  ///////////////////////// Browser Navigation /////////////////////////
  
  window.onpopstate = function(event) {

    if (event.state !== null) {

      if (event.state.scope == "year") {
        setActiveYear(parseInt(event.state.year), true)
      }

      else if (event.state.scope == "cession") {
        let cession = data.cededAreas.features.find(cessions => cessions.properties.slug === event.state.cession)
        setActiveCession(cession, true)
      }

      else if (event.state.scope == "feature") {
        let feature
        feature = data.boundaryLines.features.find(x => x.properties.slug === event.state.feature)
        if (feature == null) {
          feature = data.boundaryPoints.features.find(x => x.properties.slug === event.state.feature)
        }
        setActiveFeature(feature, true)
      }
    }
    else {

      if (initial.scope == "year") {
        setActiveYear(parseInt(initial.year), true)
      }

      else if (initial.scope == "cession") {
        let cession = data.cededAreas.features.find(cessions => cessions.properties.slug === initial.cession.properties.slug)
        setActiveCession(cession, true)
      }

      else if (initial.scope == "feature") {
        let feature
        feature = data.boundaryLines.features.find(x => x.properties.slug === initial.feature.properties.slug)
        if (feature == null) {
          feature = data.boundaryPoints.features.find(x => x.properties.slug === initial.feature.properties.slug)
        }
        setActiveFeature(feature, true)
      }
    }
  }

  ///////////////////////// Map Interactions /////////////////////////

  map.on("click", selectFeatureFromMap)
  
  map.on("mousemove", addHoverHighlights)

  map.on("mouseleave", "boundary-lines", removeLineHoverHighlight)
  
  map.on("mouseleave", "boundary-points", removePointHoverHighlight)  
  
  map.on("mouseleave", "context-points", removePointHoverHighlight) 
  
  document.getElementById('mobile-scrim').addEventListener('click', function (e) {
    expandMap()
  })
  
  document.getElementById('mobile-scrim').addEventListener('touchstart', function (e) {
    expandMap()
  })
}

function expandMap () {

  if (!document.body.contains(document.getElementById('return'))) {

    document.getElementById('mobile-scrim').classList.add('map-expanded')
    document.getElementById('timeline-section').classList.add('map-expanded')
    document.getElementById('sidebar-wrapper').classList.add('map-expanded')

    let main = document.getElementById('main')
    let returnButton = document.createElement('button')
    returnButton.id = 'return'

    returnButton.addEventListener('click', function (e) {
      collapseMap()
    })

    main.appendChild(returnButton)
  }
}

function collapseMap () {

  // Only do anything if the map is actually expanded, indicated by the presence of the return button
  if (document.body.contains(document.getElementById('return'))) {

    document.getElementById('mobile-scrim').classList.remove('map-expanded')
    document.getElementById('timeline-section').classList.remove('map-expanded')
    document.getElementById('sidebar-wrapper').classList.remove('map-expanded')

    let main = document.getElementById('main')
    let returnButton = document.getElementById('return')
    main.removeChild(returnButton)
  }
}

function handleViewportChange(e) {
  // Check if the media query is true
  if (e.matches) {
    const sidebarHeight = document.getElementById('sidebar-wrapper').offsetHeight
    mapPaddingTop = 60 //nav height + 20
    mapPaddingBottom = sidebarHeight + 40
    pointOffset = (sidebarHeight / -2) + 30
  }
  else {
    collapseMap()
    mapPaddingTop = 20
    mapPaddingBottom = 20
    pointOffset = 0
  }
}

function lineStyle(line) {
  if (line.properties.natural == "Yes" || line.properties.surveyed == "Yes") {
  return "solid"
  }
  else return "dashed"
}

class Modal {
  constructor(template) {
    this.createModal(template)
  }

  createModal(template) {
    let modalLoaded
    if (typeof window.CustomEvent === 'function') {
      modalLoaded = new Event('modalloaded')
    } else {
      modalLoaded = document.createEvent('HTMLEvents')
      modalLoaded.initEvent('modalloaded', true, true)
    }

    const overlay = this.createModalOverlay()
    const modal = this.createModalContent(template)
    const modalElements = document.createDocumentFragment()

    modalElements.appendChild(overlay)
    modalElements.appendChild(modal)

    modal.addEventListener('modalloaded', () => {
      modal.classList.add('modal--open')
      overlay.classList.add('modal__overlay--open')
    })

    document.body.style.overflow = 'hidden'
    document.body.appendChild(modalElements)

    setTimeout(() => {
      modal.dispatchEvent(modalLoaded)
    }, 100)
  }

  createModalOverlay() {
    const modalOverlay = document.createElement('div')
    modalOverlay.classList.add('modal__overlay')

    modalOverlay.addEventListener('click', () => {
      this.destroyModal()
    })

    return modalOverlay
  }

  createModalContent(template) {
    const modal = document.createElement('div')
    const modalClose = document.createElement('a')

    modal.classList.add('modal')
    modal.appendChild(template)

    modalClose.classList.add('modal__close')

    modalClose.addEventListener('click', (e) => {
      e.preventDefault()
      this.destroyModal()
    })

    modal.appendChild(modalClose)
    return modal
  }

  destroyModal() {
    const modalOverlay = document.querySelector('.modal__overlay')
    const modal = document.querySelector('.modal')
    modalOverlay.remove()
    modal.remove()
    document.body.style.overflow = 'visible'

    return this
  }
}