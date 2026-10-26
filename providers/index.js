import MockProvider from "./mockProvider.js";
import Provider from "../models/provider.module.js";

export default async function getProvider(){
    const providers = await Provider.find().sort({priority:1});
    const res = providers.map((p)=>MockProvider(p.name));
    return res;
}
