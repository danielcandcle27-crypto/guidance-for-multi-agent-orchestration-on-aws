import { useQuery } from "@tanstack/react-query";
import { post } from "aws-amplify/api";
import { fetchAuthSession } from "aws-amplify/auth";
import { QUERY_KEYS } from "../atoms/AppAtoms";

type RestAPIType = {
    opr: string;
    payload: string
}


export const callRestApi = async (data: RestAPIType) => {

    try {
        const restOperation = post({
            apiName: 'rest-api',
            path: '/prod-descr',
            options: {
                headers: {
                    Authorization: (await fetchAuthSession()).tokens?.idToken?.toString() ?? ''
                },
                body: {
                    opr: data.opr,
                    payload: data.payload
                }
            }
        })
        const { body } = await restOperation.response;
        const response = await body.json();
        return response

    } catch (err) {
        console.log(err);
        return null;
    }

};

export const useGetTransactions = (data: RestAPIType) => {
    return useQuery({
        queryKey: [QUERY_KEYS.TRANSACTIONS],
        queryFn: () => callRestApi(data),

    })
}