import { useQuery } from "@tanstack/react-query";
import { list, getUrl, downloadData } from 'aws-amplify/storage';
import { QUERY_KEYS } from "../atoms/AppAtoms";
// hard coded but can arrive from an env config/parameter store
const PROD_IMG_PATH = "product-images/"


export interface ImageType { imageName: string, url: string }
export type ImageDirType = Record<string, ImageType[]>

export const getProductImageUrl = async (imageName: string) => {
    const results = await getUrl({ path: `${PROD_IMG_PATH}${imageName}` })
    return ({
        imageName,
        url: results.url.href.toString()
    })
}

export const listProductImagesQuery = async () => {
    try {
        const result = await list({
            path: PROD_IMG_PATH,
            // Alternatively, path: ({identityId}) => `protected/${identityId}/photos/`
        });
        // this will list all images in PROD_IMG_PATH remove the PROD_IMG_PATH directory itself and list only the files within it
        const items = result.items.map(item => (item.path.split(PROD_IMG_PATH)[1])).filter(i => i.length > 0)

        // iterates over all item keys and awaits until all URLs for each individual item has been received
        const urlList = await Promise.all(items.map(async (i) => await getProductImageUrl(i))).then((values) => values) as ImageType[]


        const initialItems: ImageDirType = {}
        const reducedItems = urlList.reduce((accumulator: ImageDirType, item: ImageType) => {
            const parts = item.imageName.split("/").filter(i => i.length > 0)

            if (parts.length === 1) {
                accumulator[parts[0] as string] = []
            } else {
                accumulator[parts[0]] = [
                    ...accumulator[parts[0]] || [],
                    {
                        imageName: parts[1],
                        url: item.url
                    }
                ]
            }
            return accumulator
        }, initialItems)



        return reducedItems

    } catch (error) {
        console.log(error);
        return []
    }
}

export const useListProductImages = () => {
    return useQuery({
        queryKey: [QUERY_KEYS.PRODUCTS],
        queryFn: listProductImagesQuery
    })
}

const getTextFile = async (path: string) => {
    const downloadResult = await downloadData({ path }).result;
    const text = await downloadResult.body.text();

    return text
}

export const listTextFilesOptions = async (path: string) => {
    try {
        const demographicFiles = await list({
            path,
        });
        const items = demographicFiles.items.filter(i => i.path.split(path + "/")[1])

        const selectionList = await Promise.all(items.map(async (item) => {
            const text = await getTextFile(item.path)
            return ({
                label: item.path.split("/").pop()?.replace(".txt", ""), value: text,
            })
        }))

        return selectionList
    } catch (error) {
        console.log(error);
        return []
    }

}


export const useGetProductImage = (imageKey: string) => {
    return useQuery({
        queryKey: [QUERY_KEYS.PRODUCT, imageKey],
        queryFn: () => getProductImageUrl(imageKey),
        enabled: !!imageKey && imageKey.length > 0
    })
}