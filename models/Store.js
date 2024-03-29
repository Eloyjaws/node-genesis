const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
    name:{
        type: String,
        trim: true,
        required: 'Please Enter a Store Name!'
    },
    slug: String,
    description: {
        type: String,
        trim: true
    },
    tags: [String],
    created: {
        type: Date,
        default: Date.now
    },
    location: {
        type: {
            type: String,
            default: 'Point'
        },
        coordinates: [{
            type: Number,
            required: 'You must supply Coordinates'
        }],
        address: {
            type: String,
            required: 'You must supply an address'
        }
    },
    photo: String,
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: 'You must supply an author!'
    }
}, {
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
});

storeSchema.index({
    name: 'text',
    description: 'text'
});

storeSchema.index({location:'2dsphere'});

storeSchema.pre('save', async function(next){
    if (!this.isModified('name')) {
        next();
        return;
    }
    this.slug = slug(this.name);

    const slugRegEx = new RegExp(`^${this.slug}((-[0-9]*$)?)$`, 'i');
    const storesWithSlug = await this.constructor.find({slug: slugRegEx});
    if (storesWithSlug.length) {
        this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
    }

    next();
});

storeSchema.statics.getTagsList = function(){
    return this.aggregate([
        {$unwind: '$tags'},
        {$group: {_id: '$tags', count: {$sum: 1}}},
        {$sort: {count: -1}}
    ]);
}

storeSchema.statics.getTopStores = function(){
    return this.aggregate([
        //Find and return stores with reviews
        {$lookup: {from: 'reviews', localField: '_id', foreignField: 'store', as: 'reviews'}},
        //return stores with more than one review
        {$match: {'reviews.1': {$exists:true}}},
        //project fields with a newly generated field called average rating
        {$project: {
            name: '$$ROOT.name',
            photo: '$$ROOT.photo',
            slug: '$$ROOT.slug',
            reviews: '$$ROOT.reviews',
            averageRating: {$avg: '$reviews.rating'}
        }},
        //sort ratings in desc order
        {$sort: {averageRating: -1}},
        //limit to te stores
        {$limit: 10}
    ]);
}

storeSchema.virtual('reviews', {
    ref: 'Review',
    localField: '_id',  //fieldon the store
    foreignField: 'store' //field on the review
});

function autoPopulate(next) {
    this.populate('reviews');
    next();
}

storeSchema.pre('find', autoPopulate);
storeSchema.pre('findOne', autoPopulate);

module.exports = mongoose.model('Store', storeSchema);