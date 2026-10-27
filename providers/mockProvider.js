import Provider from '../models/provider.model.js';

class MockProvider {
    constructor(name) {
        this.name = name;
    }

    async getBalance() {
        const balance = await Provider.findOne({name: this.name}).select('balance');
        return balance?.balance ?? 0;
    }

    async send(to, parts){
        const provider = await Provider.findOne({name:this.name});

        if(!provider){
            throw new Error(`Provider ${this.name} not found`);
        }
        const randomValue = Math.random();
        console.log(randomValue)
        if(randomValue < provider.failureRate){   //make failure
            throw new Error(`Provider ${this.name} failed to send the message`);
        }

        const res = await Provider.findOneAndUpdate(
            {name:this.name},
            {$inc:{balance:-parts}},
            {returnDocument:'after'}
        );
    }
}

export default MockProvider;