
const Property = require("../models/Property");


const publicFilter = {
  status: "Approved",
  isActive: { $ne: false },
};

// GET PUBLIC PROPERTIES
exports.getProperties = (req, res) => {
  Property.find(publicFilter)
    .sort({ createdAt: -1 })
    .then((properties) => {
      res.status(200).json({
        success: true,
        count: properties.length,
        properties,
      });
    })
    .catch((error) => {
      console.log(error.message);
      res.status(500).json({
        success: false,
        message: "Failed to get properties",
      });
    });
};

// SEARCH PUBLIC PROPERTIES
exports.searchProperties = (req, res) => {
  const {
    type,
    adType,
    city,
    location,
    propertyType,
    bhkTypes,
    propertyStatus,
    newBuilderProjects,
  } = req.body;

const filter = {
  ...publicFilter,
  status: "Approved",
  isActive: { $ne: false },
};


console.log("\n========== COMMERCIAL PROPERTY SEARCH ==========");
console.log("DATABASE:", Property.db.name);
console.log("COLLECTION:", Property.collection.name);
console.log("REQUEST BODY:", req.body);
console.log("MONGODB FILTER:", JSON.stringify(filter, null, 2));

  if (type && type.toLowerCase() === "commercial") {
    filter.type = "Commercial";
    if (adType) filter.adType = adType;
  } else if (adType || type) {
    filter.adType = adType || type;
  }

  if (city) {
    filter.city = { $regex: city, $options: "i" };
  }

 
if (location) {
  // Remove spaces from the search input
  const normalizedLocation = location
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();

  // Allow optional spaces between every character
  const locationRegex = normalizedLocation
    .split("")
    .map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*");

  filter.$or = [
    { location: { $regex: locationRegex, $options: "i" } },
    { locality: { $regex: locationRegex, $options: "i" } },
    { address: { $regex: locationRegex, $options: "i" } },
  ];
}


  if (propertyType) {
    filter.propertyType = {
      $regex: propertyType,
      $options: "i",
    };
  }

  if (bhkTypes && bhkTypes.length > 0) {
    filter.bhkType = { $in: bhkTypes };
  }

  if (propertyStatus) {
    filter.propertyStatus = {
      $regex: propertyStatus,
      $options: "i",
    };
  }

  if (newBuilderProjects === true) {
    filter.newBuilderProjects = true;
  }

  console.log("\n========== FINAL PROPERTY SEARCH ==========");
console.log("DATABASE:", Property.db.name);
console.log("COLLECTION:", Property.collection.name);
console.log("REQUEST BODY:", req.body);
console.log("FINAL MONGODB FILTER:", JSON.stringify(filter, null, 2));

  // Property.find(filter)
  //   .sort({ createdAt: -1 })
  //   .then((properties) => {
  //     res.status(200).json({
  //       success: true,
  //       count: properties.length,
  //       properties,
  //     });
  //   })
  //   .catch((error) => {
  //     console.log(error.message);
  //     res.status(500).json({
  //       success: false,
  //       message: "Search failed",
  //     });
  //   });

Promise.all([
  Property.countDocuments({}),
  Property.countDocuments({ type: "Commercial" }),
  Property.countDocuments({ adType: "Rent" }),
  Property.countDocuments({
    type: "Commercial",
    adType: "Rent"
  }),
  Property.countDocuments({
    type: "Commercial",
    adType: "Rent",
    status: "Approved"
  }),
  Property.find({
    type: "Commercial",
    adType: "Rent"
  }).select("title type adType status isActive").lean()
])
// .then((results) => {
//   console.log("TOTAL PROPERTIES:", results[0]);
//   console.log("COMMERCIAL:", results[1]);
//   console.log("RENT:", results[2]);
//   console.log("COMMERCIAL RENT:", results[3]);
//   console.log("COMMERCIAL RENT APPROVED:", results[4]);
//   console.log("SAMPLE DOCUMENTS:", results[5]);
// })
.catch((err) => console.log("DEBUG ERROR:", err));
  Property.find(filter)
  .sort({ createdAt: -1 })
  .then((properties) => {
    console.log("MATCHING PROPERTY COUNT:", properties.length);
    console.log(
      "MATCHING PROPERTY TITLES:",
      properties.map((p) => p.title)
    );

    res.status(200).json({
      success: true,
      count: properties.length,
      properties,
    });
  })
  .catch((error) => {
    console.log("PROPERTY SEARCH ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Search failed",
    });
  });
};
Property.countDocuments({})
  .then((count) => {
    // console.log("TOTAL PROPERTIES IN BACKEND:", count);
  })
  .catch((err) => console.log(err.message));