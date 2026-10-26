import Provider from '../models/provider.module.js';

class MockProvider {
    constructor(name) {
        this.name = name;
    }

    async getBalance() {
        const balance = await Provider.findOne({name: this.name}).select('balance');
        return balance;
    }

    async send(to, part){
        const provider = await Provider.findOne({name:this.name});

        if(!provider){
            throw new Error(`Provider ${this.name} not found`);
        }

        if(Math.random() < provider.failureRate){   //make failure
            throw new Error(`Provider ${this.name} failed to send the message`);
        }

        const res = await Provider.findOneAndUpdate(
            {name:this.name},
            {$inc:{balance:-part}},
            {new:true}
        );
    }
}

export default MockProvider;