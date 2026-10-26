import mongoose from 'mongoose';

const providerSchema= new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    balance:{
        type:Number,
        default:0 ,
        required:true
    },
    priority:{
        type:Number,
         required:true
    },
    failureRate:{
        type:Number,
        default:0,
        required:true
    }
})

export default mongoose.model('Provider',providerSchema)