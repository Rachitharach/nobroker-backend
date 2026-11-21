
// const Property = require("../models/Property");

// function toOptionalNumber(value) {
//   if (value === "" || value === null || value === undefined) {
//     return undefined;
//   }

//   const number = Number(value);
//   return Number.isFinite(number) ? number : NaN;
// }

// function createPostProperty(req, res) {
//   const { category, listingType, city, contact, ...details } = req.body;

//   // The phone comes from the verified JWT, not the submitted form.
//   const ownerPhone = req.user?.phone;

//   if (!ownerPhone) {
//     return res.status(401).json({
//       message: "Please log in to post a property.",
//     });
//   }

//   if (
//     !category ||
//     !listingType ||
//     !city ||
//     !contact?.name ||
//     !contact?.email ||
//     !contact?.mobile ||
//     !details.location ||
//     !details.address ||
//     !details.description ||
//     details.price === "" ||
//     details.price === undefined
//   ) {
//     return res.status(400).json({
//       message: "Please provide all required property details.",
//     });
//   }

//   // Match the form's listing types to the Buy/Rent search filters.
//   let adType = listingType;

//   if (listingType === "Resale") {
//     adType = "Buy";
//   } else if (
//     listingType === "PG/Hostel" ||
//     listingType === "Flatmates"
//   ) {
//     adType = "Rent";
//   }

//   // Match the existing search controller's Commercial condition.
//   const type = category === "Commercial" ? "Commercial" : category;

//   const propertyData = {
//     title: details.title || `${category} property in ${details.location}`,
//     type,
//     adType,

//     category,
//     listingType,
//     city,
//     contact,

//     apartmentType: details.apartmentType,
//     bhkType: details.bhkType,
//     furnishing: details.furnishing,
//     commercialType: details.commercialType,
//     plotArea: toOptionalNumber(details.plotArea),
//     plotType: details.plotType,

//     location: details.location,
//     locality: details.location,
//     address: details.address,

//     // Preserve the existing search filter field.
//     propertyType:
//       category === "Residential"
//         ? details.apartmentType
//         : category === "Commercial"
//           ? details.commercialType
//           : "Land/Plot",

//     area: toOptionalNumber(details.area),
//     bathrooms: toOptionalNumber(details.bathrooms),
//     floor: details.floor,
//     availableFrom: details.availableFrom,

//     price: toOptionalNumber(details.price),
//     description: details.description,

//     ownerPhone,
//     status: "Pending",
//     isActive: true,
//   };

//   Property.create(propertyData)
//     .then((savedProperty) => {
//       return res.status(201).json({
//         success: true,
//         message: "Property submitted successfully. It is pending approval.",
//         property: savedProperty,
//       });
//     })
//     .catch((error) => {
//       console.error("Error posting property:", error);

//       return res.status(400).json({
//         success: false,
//         message: "Unable to save property.",
//         error: error.message,
//       });
//     });
// }

// module.exports = { createPostProperty };
