    /* ==========================================================================
       2. DEFAULT SEED CATEGORIES & DEMO DATA
       ========================================================================== */
    export function getSeedCategories() {
      return [
        {
          id: 'cat_food', name: 'Restaurants', icon: '🍜', order: 0,
          fields: [
            { id: 'f_dish', label: 'Must-order dish', type: 'longtext', showOnCard: true, filterable: false, order: 0 },
            { id: 'f_meal', label: 'Meal', type: 'select', options: ['Breakfast', 'Lunch', 'Dinner', 'Snack'], showOnCard: true, filterable: true, order: 1 }
          ]
        },
        {
          id: 'cat_cafe', name: 'Cafés', icon: '☕', order: 1,
          fields: [
            { id: 'f_wifi', label: 'Wifi', type: 'checkbox', showOnCard: true, filterable: true, order: 0 },
            { id: 'f_plug', label: 'Power outlets', type: 'checkbox', showOnCard: false, filterable: true, order: 1 },
            { id: 'f_vibe', label: 'Atmosphere', type: 'select', options: ['Quiet', 'Noisy', 'Outdoor'], showOnCard: true, filterable: true, order: 2 }
          ]
        },
        {
          id: 'cat_play', name: 'Activities', icon: '🎡', order: 2,
          fields: [
            { id: 'f_ticket', label: 'Entry ticket', type: 'text', showOnCard: true, filterable: false, order: 0 },
            { id: 'f_dur', label: 'Suggested time', type: 'text', showOnCard: true, filterable: false, order: 1 }
          ]
        },
        {
          id: 'cat_cloth', name: 'Clothing', icon: '👕', order: 3,
          fields: [
            { id: 'f_brand', label: 'Brand', type: 'text', showOnCard: true, filterable: false, order: 0 },
            { id: 'f_size', label: 'Size worn', type: 'text', showOnCard: true, filterable: false, order: 1 },
            { id: 'f_style', label: 'Style', type: 'multiselect', options: ['Basic', 'Smart Casual', 'Vintage', 'Sporty'], showOnCard: false, filterable: true, order: 2 }
          ]
        },
        {
          id: 'cat_gift', name: 'Gifts', icon: '🎁', order: 4,
          fields: [
            { id: 'f_occ', label: 'Suitable occasion', type: 'multiselect', options: ['Birthday', 'Anniversary', 'Graduation', 'Holidays'], showOnCard: true, filterable: true, order: 0 }
          ]
        }
      ];
    }

    export function getDemoPlaces() {
      const now = new Date().toISOString();
      return [
        {
          id: 'p_demo_1', categoryId: 'cat_food', name: 'Bánh cuốn Bà Hoành', status: 'visited',
          rating: 4.5, review: 'Thin, silky rice sheets and fragrant cinnamon pork roll. Go early in the morning to avoid waiting for a table.',
          address: '66 Tô Hiến Thành, Hai Bà Trưng, Hà Nội', mapUrl: 'https://www.google.com/maps/place/B%C3%A1nh+Cu%E1%BB%91n+B%C3%A0+Ho%C3%A0nh/@21.0145,105.8492',
          lat: 21.0145, lng: 105.8492, hours: '06:00–20:00', priceLevel: 1,
          tags: ['banh cuon', 'breakfast', 'traditional'], photos: [], visitedAt: now.slice(0, 10),
          favorite: true, customValues: { f_dish: 'Banh cuon with grilled pork + pork roll', f_meal: 'Breakfast' },
          createdAt: now, updatedAt: now
        },
        {
          id: 'p_demo_2', categoryId: 'cat_cafe', name: 'Tranquil Books & Coffee', status: 'visited',
          rating: 5, review: 'The loft corner is perfect for reading or working alone.',
          address: '5 Nguyễn Quang Bích, Hoàn Kiếm, Hà Nội', mapUrl: '',
          lat: null, lng: null, hours: '08:00–22:30', priceLevel: 2,
          tags: ['reading', 'stay long', 'egg coffee'], photos: [], visitedAt: now.slice(0, 10),
          favorite: true, customValues: { f_wifi: true, f_plug: true, f_vibe: 'Quiet' },
          createdAt: now, updatedAt: now
        },
        {
          id: 'p_demo_3', categoryId: 'cat_food', name: 'Phở Thìn Bờ Hồ', status: 'want',
          rating: null, review: 'Heard the broth is clear, with a light, traditional flavor.',
          address: '61 Đinh Tiên Hoàng, Hoàn Kiếm', mapUrl: '',
          lat: null, lng: null, hours: '06:30–21:30', priceLevel: 2,
          tags: ['beef pho', 'breakfast'], photos: [], visitedAt: null,
          favorite: false, customValues: { f_dish: 'Rare beef, well-done brisket and fatty flank', f_meal: 'Breakfast' },
          createdAt: now, updatedAt: now
        }
      ];
    }
