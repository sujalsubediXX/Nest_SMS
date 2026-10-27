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
        const provider = await Provider.findOne({ name: this.name });
        if (!provider) throw new Error(`Provider ${this.name} not found`);

        const randomValue = Math.random();
        if (randomValue < provider.failureRate) {
            throw new Error(`Provider ${this.name} failed to send the message`);
        }

        const chargedProvider = await Provider.findOneAndUpdate(
            { name: this.name, balance: { $gte: parts } },
            { $inc: { balance: -parts } },
            { returnDocument: "after" },
        );
        if (!chargedProvider) throw new Error(`Provider ${this.name} has insufficient balance`);
    }
}

export default MockProvider;