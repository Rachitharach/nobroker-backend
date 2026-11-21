
const Property = require("../models/Property");
const cloudinary = require("../config/cloudinary");

// Convert optional number fields
function toOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

// Upload one image to Cloudinary
function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "nobroker/properties",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    stream.end(file.buffer);
  });
}

// POST a new property
function createPostProperty(req, res) {
  // Frontend sends property details as JSON inside FormData
  let formData;

  try {
    formData = JSON.parse(req.body.propertyData || "{}");
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid property data.",
    });
  }

  const {
    category,
    listingType,
    city,
    contact,
    ...details
  } = formData;

  // Get phone number from verified JWT
  const ownerPhone = req.user?.phone;

  if (!ownerPhone) {
    return res.status(401).json({
      success: false,
      message: "Please log in to post a property.",
    });
  }

  // Validate required fields
  if (
    !category ||
    !listingType ||
    !city ||
    !contact?.name ||
    !contact?.email ||
    !contact?.mobile ||
    !details.location ||
    !details.address ||
    !details.description ||
    details.price === "" ||
    details.price === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: "Please provide all required property details.",
    });
  }

  // Convert listing type for existing search filters
  let adType = listingType;

  if (listingType === "Resale") {
    adType = "Buy";
  } else if (
    listingType === "PG/Hostel" ||
    listingType === "Flatmates"
  ) {
    adType = "Rent";
  }

  // Upload selected images to Cloudinary
  const files = req.files || [];

  Promise.all(files.map(uploadToCloudinary))
    .then((uploadedImages) => {
      const propertyData = {
        title:
          details.title ||
          `${category} property in ${details.location}`,

        type: category,
        adType,

        category,
        listingType,
        city,
        contact,

        ownerName: contact.name,
        ownerPhone,

        apartmentType: details.apartmentType,
        bhkType: details.bhkType,
        furnishing: details.furnishing,
        commercialType: details.commercialType,
        plotArea: toOptionalNumber(details.plotArea),
        plotType: details.plotType,

        location: details.location,
        locality: details.location,
        address: details.address,

        propertyType:
          category === "Residential"
            ? details.apartmentType
            : category === "Commercial"
              ? details.commercialType
              : "Land/Plot",

        floor: details.floor,
        availableFrom: details.availableFrom,
        area: toOptionalNumber(details.area),
        bathrooms: toOptionalNumber(details.bathrooms),
        price: toOptionalNumber(details.price),
        description: details.description,

        ...details,

        // Cloudinary image URLs and public IDs
        images: uploadedImages,

        ownerPhone,
        status: "Approved",
        isActive: true,
      };

      return Property.create(propertyData);
    })
    .then((savedProperty) => {
      return res.status(201).json({
        success: true,
        message: "Property posted successfully!",
        property: savedProperty,
      });
    })
    .catch((error) => {
      console.error("Error posting property:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to save property or upload images.",
        error: error.message,
      });
    });
}


// GET the logged-in user's properties
function getMyListings(req, res) {
  const ownerPhone = req.user?.phone;

  if (!ownerPhone) {
    return res.status(401).json({
      success: false,
      message: "Please log in to view your listings."
    });
  }

  const {
    bhkType,
    newBuilderProjects,
    minPrice,
    maxPrice,
    propertyStatus,
    furnishing,
    propertyType
  } = req.query;

  const filter = {};

  // 1. Filter by BHK type
  if (bhkType) {
    const bhkTypes = Array.isArray(bhkType) ? bhkType : [bhkType];
    filter.bhkType = { $in: bhkTypes };
  }

  // 2. Filter new builder projects
  if (newBuilderProjects === "true") {
    filter.newBuilderProjects = true;
  } else if (newBuilderProjects === "false") {
    filter.newBuilderProjects = false;
  }

  // 3. Filter by price range
  const priceFilter = {};

  if (minPrice !== undefined && minPrice !== "") {
    const min = Number(minPrice);

    if (!Number.isFinite(min) || min < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid minimum price."
      });
    }

    priceFilter.$gte = min;
  }

  if (maxPrice !== undefined && maxPrice !== "") {
    const max = Number(maxPrice);

    if (!Number.isFinite(max) || max < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid maximum price."
      });
    }

    priceFilter.$lte = max;
  }

  if (
    priceFilter.$gte !== undefined &&
    priceFilter.$lte !== undefined &&
    priceFilter.$gte > priceFilter.$lte
  ) {
    return res.status(400).json({
      success: false,
      message: "Minimum price cannot exceed maximum price."
    });
  }

  if (Object.keys(priceFilter).length > 0) {
    filter.price = priceFilter;
  }

  // 4. Filter by property status
  if (propertyStatus) {
    filter.propertyStatus = propertyStatus;
  }

  // 5. Filter by furnishing
  if (furnishing) {
    const furnishingTypes = Array.isArray(furnishing)
      ? furnishing
      : [furnishing];

    const furnishingMap = {
      Full: "Furnished",
      Semi: "Semi-Furnished",
      None: "Unfurnished"
    };

    filter.furnishing = {
      $in: furnishingTypes.map(
        (item) => furnishingMap[item] || item
      )
    };
  }

  // 6. Filter by property type
  if (propertyType) {
    const propertyTypes = Array.isArray(propertyType)
      ? propertyType
      : [propertyType];

    const propertyTypeMap = {
      "Independent House/Villa": [
        "Independent House",
        "Villa",
        "Independent House/Villa"
      ],
      Apartment: ["Apartment", "Full House"],
      "Gated Community Villa": ["Gated Community Villa"],
      "Standalone Building": ["Standalone Building"]
    };

    const matchingTypes = propertyTypes.flatMap(
      (item) => propertyTypeMap[item] || [item]
    );

    filter.$or = [
      { propertyType: { $in: matchingTypes } },
      { apartmentType: { $in: matchingTypes } }
    ];
  }

  Property.find({
    ...filter,
    ownerPhone,
  })
    .sort({ createdAt: -1 })
    .then((properties) => {
      return res.status(200).json({
        success: true,
        count: properties.length,
        properties
      });
    })
    .catch((error) => {
      console.error("Error fetching my properties:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch properties."
      });
    });
}

module.exports = {
  createPostProperty,
  getMyListings
};
