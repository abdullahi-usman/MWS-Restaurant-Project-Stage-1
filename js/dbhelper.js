/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    //const port = 8000 // Change this to your server port
    return `http://localhost:1337/restaurants`;
  }

  static get DB_VERSION() {
    return 1;
  }

  static get PATH() {
    let path = window.location.pathname.substring(window.location.pathname.indexOf('/'), window.location.pathname.lastIndexOf('/') + 1);

    return `${window.location.origin}${path}`;
  }

  static get DB() {
    if (this.idbPromised == null) {
      this.idbPromised = idb.open('restaurants.db', this.DB_VERSION, upgradeDb => {
        return upgradeDb.createObjectStore('restaurants');
      })
    }

    return this.idbPromised;
  }
  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    this.DB.then(db => {
      db.transaction('restaurants', 'readonly').objectStore('restaurants').getAll().then(storedRestaurants => {
        if (storedRestaurants && storedRestaurants.length > 0) {
          callback(null, storedRestaurants);
        } else {
          let xhr = new XMLHttpRequest();
          xhr.open('GET', DBHelper.DATABASE_URL);
          xhr.onload = () => {
            if (xhr.readyStatead === 4 && xhr.status === 200) { // Got a success response from server!
              const restaurants = JSON.parse(xhr.responseText)
              const store = db.transaction('restaurants', 'readwrite').objectStore('restaurants')
              for (var restaurant of restaurants) {
                store.put(restaurant, restaurant.id);
              }
              store.complete;

              callback(null, restaurants);
            } else { // Oops!. Got an error from server.
              const error = (`Request failed. Returned status of ${xhr.status}`);
              callback(error, null);
            }
          };
          xhr.send();
        }
      })
    })

  }

  static updateDb(restaurant) {
    this.DB.then(db => {

      const store = db.transaction('restaurants', 'readwrite').objectStore('restaurants')
      store.put(restaurant, restaurant.id);
      return store.complete;
    })
  }

  static sendReview(url, review, callback) {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true);

    const result = {}
    result.ok = false
    result.review = review

    xhr.onreadystatechange = function () {
      if (this.readyState === 4) {

        if (this.status === 200 || this.status === 201) {
          result.ok = true
          result.review = JSON.parse(this.responseText);
        }

        if (callback) {
          callback(result);
        }

      }
    }

    try {
      xhr.send(JSON.stringify(review));

    } catch (e) {
      callback(result)
    }
  }

  static onHandleReviewResponse(restaurant, response) {
    if (!restaurant.reviews) {
      restaurant.reviews = []
    }

    if (!response.ok) {
      response.review.is_cache = true;
      response.review.cache_id = Date.now()
      response.review.createdAt = response.review.cache_id
    }

    for (const review of restaurant.reviews) {
      if ((review.id && response.review.id && (review.id === response.review.id)) ||
        ((review.cache_id && response.review.cache_id) && review.cache_id === response.review.cache_id)) {
        restaurant.reviews.splice(restaurant.reviews.indexOf(review), 1);
      }
    }
    
    restaurant.reviews.push(response.review);
    DBHelper.updateDb(restaurant);
  }

  static addReview(restaurant, review, callback) {

    this.sendReview('http://localhost:1337/reviews/', review, response => {
      DBHelper.onHandleReviewResponse(restaurant, response);
      callback(response)
    })

  }

  static updateReview(restaurant, review, callback) {
    this.sendReview(`http://localhost:1337/reviews/${restaurant.id}`, review, response => {
      this.onHandleReviewResponse(restaurant, response)
    })
  }

  static retrySendCacheReview(restaurant, review, callback) {

    const cache_id = review.cache_id;

    delete review.is_cache;
    delete review.cache_id

    this.sendReview('http://localhost:1337/reviews/', review, response => {

      if (response.ok) {
        restaurant.reviews.splice(restaurant.reviews.indexOf(review), 1);
        restaurant.reviews.push(response.review);
        this.updateDb(restaurant);
      } else {
        response.review.is_cache = true;
        response.review.cache_id = cache_id;
      }

      if (callback) {
        callback(response);
      }
    })
  }


  static retrySendCacheReviews(restaurant, callback) {
    if (!restaurant.reviews) return

    const failedReviews = []
    for (let review of restaurant.reviews) {
      if (review.is_cache) {
        failedReviews.push(review)
      }
    }

    if (failedReviews.length <= 0) return;

    this.retrySendCacheReview(restaurant, failedReviews.pop(), function f(response) {

      if (failedReviews.length > 0) {
        DBHelper.retrySendCacheReview(restaurant, failedReviews.pop(), f);
      }
      if (callback) {
        callback(response);
      }
    });
  }


  static removeReview(restaurant, old_review, callback = null) {

    if (old_review.is_cache || !old_review.id) {
      restaurant.reviews.splice(restaurant.reviews.indexOf(old_review), 1);
      this.updateDb(restaurant);
    } else {
      const xhr = new XMLHttpRequest();
      xhr.open('DELETE', `http://localhost:1337/reviews/${old_review.id}`);
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || xhr.status === 404) {
            for (let review of restaurant.reviews) {
              if (review.id == old_review.id) {
                restaurant.reviews.splice(restaurant.reviews.indexOf(review), 1);
              }
            }
          } else {

            old_review.is_cache_deleted = true
          }


          this.updateDb(restaurant)

          if (callback) {
            callback(xhr.status === 200 || xhr.status == 404 ? true : false)
          }
        }
      }

      try {
        xhr.send();
      } catch (e) {
        callback(false);
      }
    }
  }

  static toggleFavorite(restaurant, callback) {
    fetch(`${this.DATABASE_URL}/${restaurant.id}/?is_favorite=${restaurant.is_favorite === "true" || restaurant.is_favorite === true ? 'false' : 'true'}`, {
      method: 'PUT'
    }).then(result => {
      return result.json()
    }).then(new_restaurant => {

      if (new_restaurant != null) {
        console.log('result', new_restaurant);
        this.updateDb(new_restaurant)
      }

      callback(new_restaurant)
    }).catch(reason => {
      console.log('failed to change favorite status: %o', reason)
      restaurant.is_favorite = !restaurant.is_favorite || restaurant.is_favorite === 'true' ? 'false' : 'true'
      restaurant.is_favorite_cache = true;
      this.updateDb(restaurant)
      callback(restaurant);
    })
  }

  static retryToggleFavorite(restaurant, callback) {
    delete restaurant.is_favorite_cache
    restaurant.is_favorite = !restaurant.is_favorite || restaurant.is_favorite === 'true' ? 'false' : 'true'
    this.toggleFavorite(restaurant, callback)
  }

  static retryDeleteCachedReviews(restaurant, callback = null) {

    if (!restaurant.reviews) {
      if (callback)
        callback();
      return;
    }

    const deletedReviews = []
    for (let review of restaurant.reviews) {
      if (review.is_cache_deleted) {
        deletedReviews.push(review)
      }
    }

    if (deletedReviews.length <= 0) {
      if (callback)
        callback();
      return;
    }

    this.removeReview(restaurant, deletedReviews.pop(), function f(ok) {

      if (deletedReviews.length > 0) {
        DBHelper.removeReview(restaurant, deletedReviews.pop(), f);
      } else {

        if (callback)
          callback();
      }
    })
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) { // Got the restaurant
          callback(null, restaurant);
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * @description Restaurant image URL.
   * @returns   The image url for the restaurant
   * 
   */
  static imageUrlForRestaurant(restaurant, type = 'medium', quality = 2) {
    return (`${this.PATH}img/${restaurant.id}-${type}_${quality}x.jpg`);
  }

  /**
   * @description Restaurant image URL for <source> tags.
   * @param restaurant - The restaurant
   * @param {string} type - The image type e.g "large" "meduim" "small"
   */

  static sourceUrlsForRestaurant(restaurant, type) {
    const x1 = this.imageUrlForRestaurant(restaurant, type, 1)
    const x2 = this.imageUrlForRestaurant(restaurant, type, 2)
    return (`${x1} 1x, ${x2} 2x`)
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker
    const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng], {
      title: restaurant.name,
      alt: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant)
    })
    marker.addTo(newMap);
    marker.bindTooltip(`${restaurant.name}  restaurant <br/> ${restaurant.latlng.lat}, ${restaurant.latlng.lng}`).openTooltip()
    return marker;
  }
  /* static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  } */

  static fetchReviews(restaurant, callback) {
    fetch(`http://localhost:1337/reviews/?restaurant_id=${restaurant.id}`).then(response => {
      return response.json();
    }).then(reviews => {
      callback(reviews);
    });
  }
}